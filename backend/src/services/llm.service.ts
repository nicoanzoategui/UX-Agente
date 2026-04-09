import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EnhancedGenerateContentResponse, Part } from '@google/generative-ai';
import { config } from '../config/env.js';
import { SYSTEM_PROMPT, getPromptForLevel } from '../prompts/system-prompt.js';
import {
    SPEC_SYSTEM,
    buildSpecUserPrompt,
    FLOWBITE_DESIGN_SYSTEM,
    buildFlowbiteDesignUserPrompt,
    HIFI_WIREFRAMES_SYSTEM,
    buildHifiWireframeUserPrompt,
    STEP_E_WIREFRAMES_SYSTEM,
    buildStepEWireframesUserPrompt,
    WIREFRAMES_SYSTEM,
    buildWireframesUserPrompt,
} from '../prompts/framework-prompts.js';
import { buildPromptCSpecPrompt } from '../prompts/prompt-c-spec.js';
import {
    UNDERSTANDING_ANALYSIS_SYSTEM,
    buildUnderstandingAnalysisUserPrompt,
} from '../prompts/understanding-analysis.js';
import {
    IDEATION_SOLUTIONS_SYSTEM,
    buildIdeationUserPrompt,
    SOLUTION_ITERATION_SYSTEM,
    buildIterationUserPrompt,
} from '../prompts/ideation-prompts.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');

/** Si el modelo configurado (p. ej. pro) devuelve 503 / alta demanda, se reintenta con este modelo. */
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isModelOverloadError(message: string): boolean {
    return (
        message.includes('503') ||
        /Service Unavailable/i.test(message) ||
        /high demand/i.test(message) ||
        /\bUNAVAILABLE\b/i.test(message) ||
        /overloaded/i.test(message)
    );
}

function formatGeminiFailureHint(modelId: string, lastMsg: string): string {
    return (
        `Fallo la llamada a Gemini (${modelId}): ${lastMsg}\n\n` +
        `Si ves 404: el id del modelo ya no existe en la API (p. ej. gemini-1.5-pro fue retirado). ` +
        `Usá nombres actuales: gemini-2.5-flash o gemini-2.5-pro (ver https://ai.google.dev/gemini-api/docs/models ).\n` +
        `Si ves 429 o cuota: probá GEMINI_MODEL=gemini-2.5-flash en backend/.env. ` +
        `Ante 503 o alta demanda en Pro, el servidor intenta automáticamente con gemini-2.5-flash.`
    );
}

function parseRetryAfterSeconds(message: string): number | null {
    const m = message.match(/retry\s+in\s+([\d.]+)\s*s/i);
    if (m) return Math.ceil(parseFloat(m[1]));
    return null;
}

function isRateLimitError(message: string): boolean {
    return (
        message.includes('429') ||
        /too\s+many\s+requests/i.test(message) ||
        /resource_exhausted/i.test(message) ||
        /quota exceeded/i.test(message)
    );
}

function looksLikeQuotaHardStop(message: string): boolean {
    return (
        /limit:\s*0\b/i.test(message) &&
        (/free_tier|GenerateRequestsPerDay|PerDay/i.test(message) || /quota exceeded/i.test(message))
    );
}

function extractGeminiText(response: EnhancedGenerateContentResponse, modelId: string): string {
    const feedback = response.promptFeedback;
    if (feedback?.blockReason) {
        throw new Error(`Gemini bloqueó el prompt (${modelId}): blockReason=${feedback.blockReason}`);
    }
    const candidates = response.candidates;
    if (!candidates?.length) {
        throw new Error(`Gemini no devolvió candidatos (${modelId}). promptFeedback=${JSON.stringify(feedback ?? null)}`);
    }
    const finish = candidates[0]?.finishReason;
    if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
        console.warn(`Gemini finishReason=${finish} (model=${modelId})`);
    }
    try {
        return response.text();
    } catch (e: unknown) {
        const hint = (e as Error)?.message || String(e);
        throw new Error(`Gemini no entregó texto (${modelId}): ${hint}. finishReason=${finish ?? 'n/a'}`);
    }
}

export interface DesignMeta {
    layout: string;
    components: string[];
    decisions: string[];
    states: Record<string, boolean>;
}

export interface DesignResult {
    content: string;
    meta?: DesignMeta;
}

export async function generateDesign(
    userStory: string,
    level: 1 | 2 | 3,
    feedback?: string,
    previousDesign?: string
): Promise<DesignResult> {
    const key = config.GEMINI_API_KEY?.trim();
    if (!key) throw new Error('GEMINI_API_KEY no está definida o está vacía.');

    const prompt = getPromptForLevel(level, userStory, feedback, previousDesign);
    const history = [
        { role: 'user' as const, parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model' as const, parts: [{ text: 'Entendido. Estoy listo para generar diseños UX/UI siguiendo todas las reglas y principios establecidos.' }] },
    ];

    const maxAttempts = 4;
    let lastMsg = '';
    let activeModelId = config.GEMINI_MODEL;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const model = genAI.getGenerativeModel({
            model: activeModelId,
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        });
        const chat = model.startChat({ history });
        try {
            const result = await chat.sendMessage(prompt);
            const raw = extractGeminiText(result.response, activeModelId);
            return extractDesignContent(raw, level);
        } catch (e: unknown) {
            lastMsg = (e as Error)?.message || String(e);
            if (isModelOverloadError(lastMsg) && activeModelId !== GEMINI_FALLBACK_MODEL) {
                console.warn(
                    `Gemini (${activeModelId}) no disponible (503 / demanda); usando ${GEMINI_FALLBACK_MODEL}.`
                );
                activeModelId = GEMINI_FALLBACK_MODEL;
                attempt -= 1;
                continue;
            }
            const hint = formatGeminiFailureHint(activeModelId, lastMsg);

            if (!isRateLimitError(lastMsg) || attempt === maxAttempts) throw new Error(hint);
            if (looksLikeQuotaHardStop(lastMsg)) throw new Error(`${hint}\n\nCuota agotada.`);

            const sec = parseRetryAfterSeconds(lastMsg) ?? 55;
            const waitMs = Math.min(Math.max(sec * 1000, 3000), 120_000);
            console.warn(`Gemini rate limit, intento ${attempt}/${maxAttempts}, esperando ${Math.round(waitMs / 1000)}s…`);
            await sleep(waitMs);
        }
    }

    throw new Error(`Gemini: agotados los reintentos (${activeModelId}). Último error: ${lastMsg}`);
}

function extractDesignContent(response: string, level: number): DesignResult {
    if (level === 3) {
        const codeMatch = response.match(/```(?:tsx?|jsx?|typescript|javascript)?\n([\s\S]*?)```/);
        const content = codeMatch
            ? codeMatch[1].trim()
            : (response.match(/((?:export\s+)?(?:default\s+)?function\s+\w+[\s\S]*)/))?.[1]?.trim() ?? response;

        let meta: DesignMeta | undefined;
        const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                meta = JSON.parse(jsonMatch[1].trim());
            } catch {
                console.warn('No se pudo parsear el bloque JSON de metadatos');
            }
        }

        return { content, meta };
    } else {
        const svgMatch = response.match(/<svg[\s\S]*?<\/svg>/);
        if (svgMatch) return { content: svgMatch[0] };

        const codeMatch = response.match(/```(?:svg|xml)?\n([\s\S]*?)```/);
        if (codeMatch) return { content: codeMatch[1].trim() };

        return { content: response };
    }
}

type GenerateTextOpts = { maxOutputTokens?: number; responseMimeType?: string };

async function generateTextWithRetries(
    systemInstruction: string,
    userText: string,
    temperature = 0.5,
    opts?: GenerateTextOpts
): Promise<string> {
    const key = config.GEMINI_API_KEY?.trim();
    if (!key) throw new Error('GEMINI_API_KEY no está definida o está vacía.');

    const combinedPrompt = `${systemInstruction.trim()}\n\n---\n\n${userText.trim()}`;

    const maxAttempts = 4;
    let lastMsg = '';
    let activeModelId = config.GEMINI_MODEL;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const model = genAI.getGenerativeModel({
            model: activeModelId,
            generationConfig: {
                temperature,
                maxOutputTokens: opts?.maxOutputTokens ?? 8192,
                ...(opts?.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
            },
        });
        try {
            const result = await model.generateContent(combinedPrompt);
            return extractGeminiText(result.response, activeModelId);
        } catch (e: unknown) {
            lastMsg = (e as Error)?.message || String(e);
            if (isModelOverloadError(lastMsg) && activeModelId !== GEMINI_FALLBACK_MODEL) {
                console.warn(
                    `Gemini (${activeModelId}) no disponible (503 / demanda); usando ${GEMINI_FALLBACK_MODEL}.`
                );
                activeModelId = GEMINI_FALLBACK_MODEL;
                attempt -= 1;
                continue;
            }
            const hint = formatGeminiFailureHint(activeModelId, lastMsg);

            if (!isRateLimitError(lastMsg) || attempt === maxAttempts) throw new Error(hint);
            if (looksLikeQuotaHardStop(lastMsg)) throw new Error(`${hint}\n\nCuota agotada.`);

            const sec = parseRetryAfterSeconds(lastMsg) ?? 55;
            const waitMs = Math.min(Math.max(sec * 1000, 3000), 120_000);
            console.warn(`Gemini rate limit, intento ${attempt}/${maxAttempts}, esperando ${Math.round(waitMs / 1000)}s…`);
            await sleep(waitMs);
        }
    }

    throw new Error(`Gemini: agotados los reintentos (${activeModelId}). Último error: ${lastMsg}`);
}

export async function generateSpecFromTranscript(
    transcript: string,
    feedback?: string
): Promise<string> {
    const raw = await generateTextWithRetries(SPEC_SYSTEM, buildSpecUserPrompt(transcript, feedback), 0.4);
    return raw.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/** Spec con Prompt C (agente de producto — estructura fija, límite de palabras). */
export async function generateSpecWithPromptC(transcript: string): Promise<string> {
    const raw = await generateTextWithRetries(
        'Respondé únicamente con el cuerpo del spec en Markdown, sin introducción ni texto fuera de las secciones pedidas.',
        buildPromptCSpecPrompt(transcript),
        0.4
    );
    return raw.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export interface WireframeOptionParsed {
    optionIndex: 1 | 2 | 3;
    title: string;
    description: string;
    html: string;
    /** Bloque COMPONENTS: del diseño Flowbite (patrones / piezas usadas). */
    components?: string;
}

/** Fuerza un único wireframe con índice 1 (baja o alta fidelidad). */
export function normalizeToSingleWireframe(parsed: WireframeOptionParsed[]): WireframeOptionParsed[] {
    if (parsed.length === 0) return [];
    const o = parsed[0];
    return [
        {
            optionIndex: 1,
            title: o.title?.trim() || 'Wireframe',
            description: o.description?.trim() || '',
            html: o.html,
            components: o.components?.trim() || '',
        },
    ];
}

export function parseWireframeOptions(raw: string): WireframeOptionParsed[] {
    const parts = raw.split(/---OPTION_([123])---/);
    const out: WireframeOptionParsed[] = [];

    for (let i = 1; i < parts.length; i += 2) {
        const num = Number(parts[i]) as 1 | 2 | 3;
        const body = parts[i + 1] ?? '';
        const titleM = body.match(/TITLE:\s*(.+?)(?:\r?\n|$)/im);
        const descM =
            body.match(/DESC:\s*([\s\S]+?)(?=\r?\nCOMPONENTS:|\r?\nHTML:)/i) ||
            body.match(/DESC:\s*(.+?)(?:\r?\nHTML:)/is) ||
            body.match(/DESC:\s*(.+?)(?:\r?\n|$)/im);
        const componentsM = body.match(/\r?\nCOMPONENTS:\s*([\s\S]+?)(?=\r?\nHTML:)/i);
        const htmlMatch = body.match(/HTML:\s*([\s\S]+)/i);
        let html = htmlMatch?.[1]?.trim() ?? '';
        html = html.replace(/^```(?:html)?\s*/i, '').replace(/```[\s\S]*$/i, '').trim();
        if (!html) html = '<div style="padding:1rem;font-family:system-ui;color:#666">Sin HTML parseado</div>';

        out.push({
            optionIndex: num,
            title: titleM?.[1]?.trim() || `Opción ${num}`,
            description: descM?.[1]?.trim() || '',
            html,
            components: componentsM?.[1]?.trim() || '',
        });
    }

    return out.sort((a, b) => a.optionIndex - b.optionIndex);
}

export async function generateWireframeOptionsFromSpec(
    specMarkdown: string,
    feedback?: string
): Promise<WireframeOptionParsed[]> {
    const raw = await generateTextWithRetries(
        WIREFRAMES_SYSTEM,
        buildWireframesUserPrompt(specMarkdown, feedback),
        0.65
    );
    return parseWireframeOptions(raw);
}

export async function generateHifiWireframeFromSpecAndLowFi(
    specMarkdown: string,
    low: { title: string; description: string; html: string }
): Promise<WireframeOptionParsed[]> {
    const raw = await generateTextWithRetries(
        HIFI_WIREFRAMES_SYSTEM,
        buildHifiWireframeUserPrompt(specMarkdown, low, config.HIFI_VIEWPORT),
        0.55,
        { maxOutputTokens: 16384 }
    );
    return normalizeToSingleWireframe(parseWireframeOptions(raw));
}

export async function generateFlowbiteDesignFromHifi(
    specMarkdown: string,
    hifi: { title: string; description: string; html: string },
    feedback?: string
): Promise<WireframeOptionParsed[]> {
    const raw = await generateTextWithRetries(
        FLOWBITE_DESIGN_SYSTEM,
        buildFlowbiteDesignUserPrompt(specMarkdown, hifi, feedback),
        0.55,
        { maxOutputTokens: 16384 }
    );
    return normalizeToSingleWireframe(parseWireframeOptions(raw));
}

export interface StepEWireframeOption {
    title: string;
    uxRationale: string;
    htmlContent: string;
}

function parseStepEWireframesJson(raw: string): StepEWireframeOption[] {
    let t = raw.trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('[');
    const end = t.lastIndexOf(']');
    if (start === -1 || end <= start) {
        throw new Error('La respuesta no contiene un array JSON de wireframes.');
    }
    t = t.slice(start, end + 1);
    let parsed: unknown;
    try {
        parsed = JSON.parse(t) as unknown;
    } catch {
        throw new Error('No se pudo parsear el JSON de wireframes (respuesta truncada o inválida).');
    }
    if (!Array.isArray(parsed)) {
        throw new Error('Se esperaba un array JSON con 3 wireframes.');
    }
    const out: StepEWireframeOption[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        const uxRationale =
            typeof o.uxRationale === 'string'
                ? o.uxRationale.trim()
                : typeof o.ux_rationale === 'string'
                  ? o.ux_rationale.trim()
                  : '';
        const htmlContent =
            typeof o.htmlContent === 'string'
                ? o.htmlContent.trim()
                : typeof o.html_content === 'string'
                  ? o.html_content.trim()
                  : '';
        if (title && htmlContent) {
            out.push({ title, uxRationale, htmlContent });
        }
    }
    if (out.length !== 3) {
        throw new Error(
            `Se esperaban 3 opciones válidas (title + htmlContent); el modelo devolvió ${out.length}.`
        );
    }
    return out;
}

/** Orquestador Paso E: 3 wireframes responsivos desde spec (no toca el flujo kanban de una sola opción). */
export async function generateStepEWireframeOptions(specText: string): Promise<StepEWireframeOption[]> {
    const user = buildStepEWireframesUserPrompt(specText);
    let raw: string;
    try {
        raw = await generateTextWithRetries(STEP_E_WIREFRAMES_SYSTEM, user, 0.55, {
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
        });
    } catch (e) {
        console.warn('Paso E: reintentando sin responseMimeType JSON:', (e as Error)?.message ?? e);
        raw = await generateTextWithRetries(STEP_E_WIREFRAMES_SYSTEM, user, 0.55, {
            maxOutputTokens: 16384,
        });
    }
    return parseStepEWireframesJson(raw);
}

export type UnderstandingAnalysisAttachment = {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
};

export type UnderstandingAnalysisResult = {
    executiveSummary: string;
    contextSynthesis: string;
    businessObjectives: string[];
    keyInsights: string[];
    userPainPoints: string[];
    opportunities: string[];
    risksAndConstraints: string[];
    openQuestions: string[];
    suggestedFocusForIdeation: string;
};

const UNDERSTANDING_MAX_TEXT = 120_000;

function truncateUnderstandingText(s: string): string {
    if (s.length <= UNDERSTANDING_MAX_TEXT) return s;
    return `${s.slice(0, UNDERSTANDING_MAX_TEXT)}\n\n[… texto truncado por tamaño …]`;
}

function guessAttachmentMime(file: UnderstandingAnalysisAttachment): string {
    const m = file.mimeType?.trim();
    if (m && m !== 'application/octet-stream') return m;
    const n = file.originalName.toLowerCase();
    if (n.endsWith('.pdf')) return 'application/pdf';
    if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (n.endsWith('.doc')) return 'application/msword';
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.gif')) return 'image/gif';
    if (n.endsWith('.md') || n.endsWith('.txt')) return 'text/plain; charset=utf-8';
    return file.mimeType || 'application/octet-stream';
}

function isUtf8TextMime(mime: string): boolean {
    return mime.startsWith('text/') || mime === 'application/json';
}

export function parseUnderstandingAnalysisJson(raw: string): UnderstandingAnalysisResult {
    let t = raw.trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new Error('La respuesta no contiene un objeto JSON de análisis.');
    }
    t = t.slice(start, end + 1);
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(t) as Record<string, unknown>;
    } catch {
        throw new Error('No se pudo parsear el JSON del análisis de contexto.');
    }
    const str = (k: string) => (typeof parsed[k] === 'string' ? (parsed[k] as string).trim() : '');
    const arr = (k: string): string[] =>
        Array.isArray(parsed[k])
            ? (parsed[k] as unknown[]).filter((x) => typeof x === 'string').map((x) => (x as string).trim())
            : [];
    return {
        executiveSummary: str('executiveSummary') || 'Sin resumen ejecutivo.',
        contextSynthesis: str('contextSynthesis') || '',
        businessObjectives: arr('businessObjectives'),
        keyInsights: arr('keyInsights'),
        userPainPoints: arr('userPainPoints'),
        opportunities: arr('opportunities'),
        risksAndConstraints: arr('risksAndConstraints'),
        openQuestions: arr('openQuestions'),
        suggestedFocusForIdeation: str('suggestedFocusForIdeation') || '',
    };
}

export async function generateUnderstandingAnalysis(input: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    notes: string;
    fileManifest: { name: string; tag: string; sizeBytes?: number }[];
    contextFiles: UnderstandingAnalysisAttachment[];
    screenshots: UnderstandingAnalysisAttachment[];
}): Promise<UnderstandingAnalysisResult> {
    const key = config.GEMINI_API_KEY?.trim();
    if (!key) throw new Error('GEMINI_API_KEY no está definida o está vacía.');

    let activeModelId = config.GEMINI_MODEL;
    const meta = {
        initiativeName: input.initiativeName,
        jiraTicket: input.jiraTicket,
        squad: input.squad,
        notes: input.notes,
        fileManifest: input.fileManifest,
    };
    const baseText = buildUnderstandingAnalysisUserPrompt(meta);

    const parts: Part[] = [{ text: baseText }];

    if (input.contextFiles.length > 0) {
        parts.push({ text: '\n\n--- Documentos de contexto adjuntos ---\n' });
    }
    for (const f of input.contextFiles) {
        const mime = guessAttachmentMime(f);
        const name = f.originalName || 'archivo';
        if (isUtf8TextMime(mime) || /\.(txt|md|markdown)$/i.test(name)) {
            const txt = truncateUnderstandingText(f.buffer.toString('utf-8'));
            parts.push({ text: `\n### ${name}\n${txt}\n` });
        } else {
            parts.push({ text: `\n[Documento: ${name}]\n` });
            parts.push({
                inlineData: {
                    mimeType: mime,
                    data: f.buffer.toString('base64'),
                },
            });
        }
    }

    if (input.screenshots.length > 0) {
        parts.push({ text: '\n\n--- Capturas del flujo actual ---\n' });
    }
    for (const f of input.screenshots) {
        const mime = guessAttachmentMime(f);
        const imgMime = mime.startsWith('image/') ? mime : 'image/png';
        const name = f.originalName || 'captura';
        parts.push({ text: `\n[Captura: ${name}]\n` });
        parts.push({
            inlineData: {
                mimeType: imgMime,
                data: f.buffer.toString('base64'),
            },
        });
    }

    const maxAttempts = 4;
    let lastMsg = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            let raw: string;
            try {
                const model = genAI.getGenerativeModel({
                    model: activeModelId,
                    systemInstruction: UNDERSTANDING_ANALYSIS_SYSTEM,
                    generationConfig: {
                        temperature: 0.35,
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json',
                    },
                });
                const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
                raw = extractGeminiText(result.response, activeModelId);
            } catch (e) {
                console.warn(
                    'Análisis contexto: reintentando sin responseMimeType JSON:',
                    (e as Error)?.message ?? e
                );
                const model = genAI.getGenerativeModel({
                    model: activeModelId,
                    systemInstruction: UNDERSTANDING_ANALYSIS_SYSTEM,
                    generationConfig: {
                        temperature: 0.35,
                        maxOutputTokens: 8192,
                    },
                });
                const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
                raw = extractGeminiText(result.response, activeModelId);
            }
            return parseUnderstandingAnalysisJson(raw);
        } catch (e: unknown) {
            lastMsg = (e as Error)?.message || String(e);
            if (isModelOverloadError(lastMsg) && activeModelId !== GEMINI_FALLBACK_MODEL) {
                console.warn(
                    `Gemini (${activeModelId}) no disponible (503 / demanda); usando ${GEMINI_FALLBACK_MODEL}.`
                );
                activeModelId = GEMINI_FALLBACK_MODEL;
                attempt -= 1;
                continue;
            }
            const hint = formatGeminiFailureHint(activeModelId, lastMsg);

            if (!isRateLimitError(lastMsg) || attempt === maxAttempts) throw new Error(hint);
            if (looksLikeQuotaHardStop(lastMsg)) throw new Error(`${hint}\n\nCuota agotada.`);

            const sec = parseRetryAfterSeconds(lastMsg) ?? 55;
            const waitMs = Math.min(Math.max(sec * 1000, 3000), 120_000);
            console.warn(`Gemini rate limit (understanding), intento ${attempt}/${maxAttempts}, esperando…`);
            await sleep(waitMs);
        }
    }

    throw new Error(`Gemini: agotados los reintentos (${activeModelId}). Último error: ${lastMsg}`);
}

export type IdeationSolutionDto = {
    title: string;
    recommendedByAi: boolean;
    flowSteps: string[];
    howItSolves: string[];
    expectedImpact: string[];
};

function parseIdeationSolutionsJson(raw: string): IdeationSolutionDto[] {
    let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new Error('La respuesta no contiene JSON de ideación.');
    }
    t = t.slice(start, end + 1);
    let parsed: { solutions?: unknown };
    try {
        parsed = JSON.parse(t) as { solutions?: unknown };
    } catch {
        throw new Error('No se pudo parsear el JSON de ideación.');
    }
    if (!Array.isArray(parsed.solutions) || parsed.solutions.length !== 3) {
        throw new Error('Se esperaban exactamente 3 soluciones en "solutions".');
    }
    const out: IdeationSolutionDto[] = [];
    for (const item of parsed.solutions) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        const recommendedByAi = o.recommendedByAi === true;
        const flowSteps = Array.isArray(o.flowSteps)
            ? (o.flowSteps as unknown[]).filter((x) => typeof x === 'string').map((x) => (x as string).trim())
            : [];
        const howItSolves = Array.isArray(o.howItSolves)
            ? (o.howItSolves as unknown[]).filter((x) => typeof x === 'string').map((x) => (x as string).trim())
            : [];
        const expectedImpact = Array.isArray(o.expectedImpact)
            ? (o.expectedImpact as unknown[]).filter((x) => typeof x === 'string').map((x) => (x as string).trim())
            : [];
        if (!title || flowSteps.length < 3) {
            throw new Error('Cada solución requiere title y al menos 3 flowSteps.');
        }
        out.push({
            title,
            recommendedByAi,
            flowSteps,
            howItSolves: howItSolves.length ? howItSolves : ['—'],
            expectedImpact: expectedImpact.length ? expectedImpact : ['—'],
        });
    }
    if (out.length !== 3) throw new Error('No se pudieron validar 3 soluciones.');
    if (!out.some((s) => s.recommendedByAi)) out[0].recommendedByAi = true;
    return out;
}

export async function generateIdeationSolutions(input: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    analysis: UnderstandingAnalysisResult;
}): Promise<IdeationSolutionDto[]> {
    const user = buildIdeationUserPrompt({
        initiativeName: input.initiativeName,
        jiraTicket: input.jiraTicket,
        squad: input.squad,
        analysisJson: JSON.stringify(input.analysis),
    });
    let raw: string;
    try {
        raw = await generateTextWithRetries(IDEATION_SOLUTIONS_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
        });
    } catch (e) {
        console.warn('Ideación: reintentando sin responseMimeType JSON:', (e as Error)?.message ?? e);
        raw = await generateTextWithRetries(IDEATION_SOLUTIONS_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
        });
    }
    return parseIdeationSolutionsJson(raw);
}

export async function generateSolutionIterationReply(input: {
    solutionTitle: string;
    initiativeName: string;
    analysis: UnderstandingAnalysisResult;
    history: { role: 'user' | 'assistant'; text: string }[];
    userMessage: string;
}): Promise<string> {
    const analysisSummary = JSON.stringify(input.analysis);
    const conversationSnippet = input.history
        .slice(-10)
        .map((h) => `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.text}`)
        .join('\n');
    const user = buildIterationUserPrompt({
        solutionTitle: input.solutionTitle,
        initiativeName: input.initiativeName,
        analysisSummary,
        conversationSnippet,
        userMessage: input.userMessage.trim(),
    });
    const reply = await generateTextWithRetries(SOLUTION_ITERATION_SYSTEM, user, 0.55, {
        maxOutputTokens: 4096,
    });
    return reply.trim();
}