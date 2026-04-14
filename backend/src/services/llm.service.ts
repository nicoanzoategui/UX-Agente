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
import { HANDOFF_BUNDLE_SYSTEM } from '../prompts/handoff-zip-prompts.js';
import JSZip from 'jszip';
import {
    IDEATION_SOLUTIONS_SYSTEM,
    buildIdeationUserPrompt,
    SOLUTION_ITERATION_SYSTEM,
    buildIterationUserPrompt,
    SOLUTION_ITERATION_JSON_SYSTEM,
    buildIterationJsonUserPrompt,
} from '../prompts/ideation-prompts.js';
import {
    PROTOTYPE_FLOW_SYSTEM,
    buildPrototypeFlowUserPrompt,
    PROTOTYPE_ITERATION_SYSTEM,
    buildPrototypeIterationUserPrompt,
} from '../prompts/prototype-flow-prompts.js';
import {
    FULL_FLOW_HIFI_HTML_SYSTEM,
    TSX_FROM_FIGMA_SCREENS_SYSTEM,
    TSX_MUI_SCREENS_SYSTEM,
    USER_FLOW_CHAT_SYSTEM,
    USER_FLOW_SVG_SYSTEM,
    buildFullFlowHifiUserPrompt,
    buildTsxFromFigmaUserPrompt,
    buildTsxMuiUserPrompt,
    buildUserFlowChatUserPrompt,
    buildUserFlowSvgUserPrompt,
} from '../prompts/platform-post-prototype-prompts.js';
import { fetchFigmaScreenPngs, parseFigmaDesignUrl } from './figma.service.js';

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

async function generateMultimodalTextWithRetries(
    systemInstruction: string,
    parts: Part[],
    temperature = 0.5,
    opts?: GenerateTextOpts
): Promise<string> {
    const key = config.GEMINI_API_KEY?.trim();
    if (!key) throw new Error('GEMINI_API_KEY no está definida o está vacía.');

    const maxAttempts = 4;
    let lastMsg = '';
    let activeModelId = config.GEMINI_MODEL;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const model = genAI.getGenerativeModel({
            model: activeModelId,
            systemInstruction: systemInstruction.trim(),
            generationConfig: {
                temperature,
                maxOutputTokens: opts?.maxOutputTokens ?? 8192,
                ...(opts?.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
            },
        });
        try {
            const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
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

/** Endpoint HTTP inferido o leído desde OpenAPI/Swagger en Entendimiento. */
export type ApiEndpointDescriptor = {
    method: string;
    path: string;
    summary?: string;
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
    /** Presente cuando se adjuntó spec de API y el modelo extrajo operaciones. */
    availableEndpoints?: ApiEndpointDescriptor[];
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
    if (n.endsWith('.yaml') || n.endsWith('.yml')) return 'text/yaml; charset=utf-8';
    return file.mimeType || 'application/octet-stream';
}

function isUtf8TextMime(mime: string): boolean {
    return (
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        mime === 'application/x-yaml' ||
        mime === 'text/yaml' ||
        mime === 'application/yaml'
    );
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
    const base: UnderstandingAnalysisResult = {
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
    const rawEp = parsed.availableEndpoints;
    if (Array.isArray(rawEp) && rawEp.length > 0) {
        const availableEndpoints: ApiEndpointDescriptor[] = [];
        for (const item of rawEp) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const method = typeof o.method === 'string' ? o.method.trim().toUpperCase() : '';
            const path = typeof o.path === 'string' ? o.path.trim() : '';
            const summary = typeof o.summary === 'string' ? o.summary.trim() : undefined;
            if (!method || !path) continue;
            availableEndpoints.push({ method, path, ...(summary ? { summary } : {}) });
        }
        if (availableEndpoints.length > 0) base.availableEndpoints = availableEndpoints;
    }
    return base;
}

export async function generateUnderstandingAnalysis(input: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    notes: string;
    fileManifest: { name: string; tag: string; sizeBytes?: number }[];
    contextFiles: UnderstandingAnalysisAttachment[];
    screenshots: UnderstandingAnalysisAttachment[];
    /** OpenAPI/Swagger/Markdown de API (opcional). */
    apiSpec?: UnderstandingAnalysisAttachment | null;
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

    if (input.apiSpec && input.apiSpec.buffer.length > 0) {
        const f = input.apiSpec;
        const mime = guessAttachmentMime(f);
        const name = f.originalName || 'api-spec';
        parts.push({ text: '\n\n--- Especificación de API (OpenAPI/Swagger/Markdown) ---\n' });
        if (isUtf8TextMime(mime) || /\.(txt|md|markdown|json|ya?ml)$/i.test(name)) {
            const txt = truncateUnderstandingText(f.buffer.toString('utf-8'));
            parts.push({ text: `### ${name}\n${txt}\n` });
        } else {
            parts.push({ text: `\n[Documento API: ${name}]\n` });
            parts.push({
                inlineData: {
                    mimeType: mime,
                    data: f.buffer.toString('base64'),
                },
            });
        }
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

function parseRefinedIdeationSolution(o: unknown): IdeationSolutionDto | null {
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    const flowSteps = Array.isArray(rec.flowSteps)
        ? (rec.flowSteps as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    if (!title || flowSteps.length < 3) return null;
    const howItSolves = Array.isArray(rec.howItSolves)
        ? (rec.howItSolves as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    const expectedImpact = Array.isArray(rec.expectedImpact)
        ? (rec.expectedImpact as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    return {
        title,
        recommendedByAi: rec.recommendedByAi === true,
        flowSteps,
        howItSolves: howItSolves.length ? howItSolves : ['—'],
        expectedImpact: expectedImpact.length ? expectedImpact : ['—'],
    };
}

function parseSolutionIterationJsonResponse(raw: string): { reply: string; refinedSolution?: IdeationSolutionDto } {
    let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) {
        return { reply: raw.trim() || 'Sin respuesta del modelo.', refinedSolution: undefined };
    }
    t = t.slice(start, end + 1);
    let parsed: { assistantMessage?: unknown; refinedSolution?: unknown };
    try {
        parsed = JSON.parse(t) as { assistantMessage?: unknown; refinedSolution?: unknown };
    } catch {
        return { reply: raw.trim() || 'No se pudo interpretar la respuesta.', refinedSolution: undefined };
    }
    const assistantMessage =
        typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage.trim() : '';
    const refined = parseRefinedIdeationSolution(parsed.refinedSolution);
    return {
        reply: assistantMessage || 'Listo, actualicé la propuesta según tu mensaje.',
        refinedSolution: refined ?? undefined,
    };
}

export async function generateSolutionIterationReply(input: {
    solution: IdeationSolutionDto;
    initiativeName: string;
    analysis: UnderstandingAnalysisResult;
    history: { role: 'user' | 'assistant'; text: string }[];
    userMessage: string;
}): Promise<{ reply: string; refinedSolution?: IdeationSolutionDto }> {
    const conversationSnippet = input.history
        .slice(-10)
        .map((h) => `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.text}`)
        .join('\n');
    const user = buildIterationJsonUserPrompt({
        initiativeName: input.initiativeName,
        analysisJson: JSON.stringify(input.analysis),
        solutionJson: JSON.stringify(input.solution),
        conversationSnippet,
        userMessage: input.userMessage.trim(),
    });
    let raw: string;
    try {
        raw = await generateTextWithRetries(SOLUTION_ITERATION_JSON_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
        });
    } catch (e) {
        console.warn('Iteración solución: reintentando sin responseMimeType JSON:', (e as Error)?.message ?? e);
        raw = await generateTextWithRetries(SOLUTION_ITERATION_JSON_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
        });
    }
    const parsed = parseSolutionIterationJsonResponse(raw);
    if (parsed.refinedSolution) {
        return parsed;
    }
    const analysisSummary = JSON.stringify(input.analysis);
    const fallbackUser = buildIterationUserPrompt({
        solutionTitle: input.solution.title,
        initiativeName: input.initiativeName,
        analysisSummary,
        conversationSnippet,
        userMessage: input.userMessage.trim(),
    });
    const plain = await generateTextWithRetries(SOLUTION_ITERATION_SYSTEM, fallbackUser, 0.55, {
        maxOutputTokens: 4096,
    });
    return { reply: plain.trim(), refinedSolution: undefined };
}

export type PrototypeScreenSpecDto = {
    title: string;
    subtitle?: string;
    bullets?: string[];
    note?: string;
    cta?: string;
};

/** Pantallas lógicas derivadas solo de la solución de ideación (sin prototipo previo). */
export function pseudoScreensFromIdeationSolution(solution: IdeationSolutionDto): PrototypeScreenSpecDto[] {
    return solution.flowSteps.map((text, i) => ({
        title: text.trim().slice(0, 200) || `Paso ${i + 1}`,
        subtitle: solution.title.trim().slice(0, 160),
    }));
}

export type PrototypeFlowResultDto = {
    summaryLine: string;
    screens: PrototypeScreenSpecDto[];
    estimatedTimeLabel: string;
    flowType: string;
};

function parsePrototypeFlowJson(raw: string): PrototypeFlowResultDto {
    let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new Error('La respuesta no contiene JSON del prototipo.');
    }
    t = t.slice(start, end + 1);
    let parsed: {
        summaryLine?: unknown;
        estimatedTimeLabel?: unknown;
        flowType?: unknown;
        screens?: unknown;
    };
    try {
        parsed = JSON.parse(t) as {
            summaryLine?: unknown;
            estimatedTimeLabel?: unknown;
            flowType?: unknown;
            screens?: unknown;
        };
    } catch {
        throw new Error('No se pudo parsear el JSON del prototipo.');
    }
    const summaryLine =
        typeof parsed.summaryLine === 'string' ? parsed.summaryLine.trim().slice(0, 200) : '';
    if (!Array.isArray(parsed.screens) || parsed.screens.length !== 6) {
        throw new Error('Se esperaban exactamente 6 pantallas en "screens".');
    }
    const screens: PrototypeScreenSpecDto[] = [];
    for (const item of parsed.screens) {
        if (!item || typeof item !== 'object') {
            throw new Error('Cada pantalla del prototipo debe ser un objeto.');
        }
        const o = item as Record<string, unknown>;
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        if (!title) {
            throw new Error('Cada pantalla requiere "title".');
        }
        const subtitle = typeof o.subtitle === 'string' ? o.subtitle.trim() : undefined;
        const note = typeof o.note === 'string' ? o.note.trim() : undefined;
        const cta = typeof o.cta === 'string' ? o.cta.trim() : undefined;
        const bullets = Array.isArray(o.bullets)
            ? (o.bullets as unknown[]).filter((x) => typeof x === 'string').map((x) => (x as string).trim())
            : undefined;
        screens.push({
            title,
            ...(subtitle ? { subtitle } : {}),
            ...(bullets?.length ? { bullets } : {}),
            ...(note ? { note } : {}),
            ...(cta ? { cta } : {}),
        });
    }
    const n = screens.length;
    let estimatedTimeLabel =
        typeof parsed.estimatedTimeLabel === 'string' ? parsed.estimatedTimeLabel.trim().slice(0, 32) : '';
    let flowType = typeof parsed.flowType === 'string' ? parsed.flowType.trim().slice(0, 48) : '';
    if (!estimatedTimeLabel) {
        estimatedTimeLabel = `~${Math.max(1, Math.round(n * 0.35))} min`;
    }
    if (!flowType) {
        flowType = 'Lineal';
    }
    return {
        summaryLine: summaryLine || 'Flujo prototipado en 6 pasos',
        screens,
        estimatedTimeLabel,
        flowType,
    };
}

export async function generatePrototypeFlowScreens(input: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    analysis: UnderstandingAnalysisResult;
    solution: IdeationSolutionDto;
    iterationMessages?: { role: 'user' | 'assistant'; text: string }[];
    existingScreens?: PrototypeScreenSpecDto[];
    prototypeIterationMessages?: { role: 'user' | 'assistant'; text: string }[];
}): Promise<PrototypeFlowResultDto> {
    const lines: string[] = [];
    for (const m of input.iterationMessages ?? []) {
        if (!m?.text?.trim()) continue;
        const who = m.role === 'assistant' ? 'Agente' : 'Usuario';
        lines.push(`${who}: ${m.text.trim()}`);
    }
    const iterationTranscript = lines.join('\n\n').slice(0, 16_000);

    const protoLines: string[] = [];
    for (const m of input.prototypeIterationMessages ?? []) {
        if (!m?.text?.trim()) continue;
        const who = m.role === 'assistant' ? 'Agente' : 'Usuario';
        protoLines.push(`${who}: ${m.text.trim()}`);
    }
    const prototypeIterationTranscript = protoLines.join('\n\n').slice(0, 16_000);

    const existingScreensJson =
        input.existingScreens && input.existingScreens.length === 6
            ? JSON.stringify(input.existingScreens).slice(0, 24_000)
            : undefined;

    const user = buildPrototypeFlowUserPrompt({
        initiativeName: input.initiativeName,
        jiraTicket: input.jiraTicket,
        squad: input.squad,
        analysisJson: JSON.stringify(input.analysis),
        solutionJson: JSON.stringify(input.solution),
        iterationTranscript,
        existingScreensJson,
        prototypeIterationTranscript: prototypeIterationTranscript || undefined,
    });

    let raw: string;
    try {
        raw = await generateTextWithRetries(PROTOTYPE_FLOW_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
        });
    } catch (e) {
        console.warn('Prototipo: reintentando sin responseMimeType JSON:', (e as Error)?.message ?? e);
        raw = await generateTextWithRetries(PROTOTYPE_FLOW_SYSTEM, user, 0.45, {
            maxOutputTokens: 8192,
        });
    }
    return parsePrototypeFlowJson(raw);
}

export async function generatePrototypeIterationReply(input: {
    initiativeName: string;
    solution: IdeationSolutionDto;
    screens: PrototypeScreenSpecDto[];
    history: { role: 'user' | 'assistant'; text: string }[];
    userMessage: string;
}): Promise<string> {
    if (!Array.isArray(input.screens) || input.screens.length !== 6) {
        throw new Error('Se requieren exactamente 6 pantallas del prototipo.');
    }
    const conversationSnippet = input.history
        .slice(-10)
        .map((h) => `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.text}`)
        .join('\n');
    const user = buildPrototypeIterationUserPrompt({
        initiativeName: input.initiativeName,
        solutionJson: JSON.stringify(input.solution),
        screensJson: JSON.stringify(input.screens),
        conversationSnippet,
        userMessage: input.userMessage.trim(),
    });
    const reply = await generateTextWithRetries(PROTOTYPE_ITERATION_SYSTEM, user, 0.55, {
        maxOutputTokens: 4096,
    });
    return reply.trim();
}

function extractFirstSvg(raw: string): string {
    const t = raw.trim();
    const m = t.match(/<svg[\s\S]*?<\/svg>/i);
    if (m) return m[0];
    const code = t.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i);
    if (code) {
        const inner = code[1].trim();
        const m2 = inner.match(/<svg[\s\S]*?<\/svg>/i);
        if (m2) return m2[0];
    }
    throw new Error('El modelo no devolvió un SVG de user flow válido.');
}

function escapeSvgText(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** SVG mínimo en línea cuando Gemini no devuelve markup válido. */
function buildFallbackUserFlowSvg(solution: IdeationSolutionDto): string {
    const steps = solution.flowSteps.filter((x) => x.trim().length > 0);
    const labels = steps.length > 0 ? steps : ['Paso sin definir'];
    const n = labels.length;
    const boxW = 220;
    const gap = 40;
    const startX = 32;
    const yBox = 72;
    const boxH = 76;
    const vbW = startX * 2 + n * boxW + Math.max(0, n - 1) * gap;
    const vbH = 220;
    const title = escapeSvgText(solution.title.trim().slice(0, 100) || 'User flow');

    const markerId = `arrow-uf-fb-${Math.random().toString(36).slice(2, 9)}`;
    const parts: string[] = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">`,
        '<defs>',
        `<marker id="${markerId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#475569"/></marker>`,
        '</defs>',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        `<text x="24" y="40" font-size="15" font-weight="600" fill="#334155" font-family="system-ui,sans-serif">${title}</text>`,
        `<text x="24" y="58" font-size="11" fill="#64748b" font-family="system-ui,sans-serif">${escapeSvgText('Diagrama de respaldo — revisar con el agente o regenerar.')}</text>`,
    ];

    for (let i = 0; i < n; i++) {
        const x = startX + i * (boxW + gap);
        const label = escapeSvgText(labels[i].trim().slice(0, 120));
        parts.push(
            `<rect x="${x}" y="${yBox}" width="${boxW}" height="${boxH}" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>`,
            `<text x="${x + boxW / 2}" y="${yBox + boxH / 2 + 4}" text-anchor="middle" font-size="13" fill="#0f172a" font-family="system-ui,sans-serif">${label}</text>`
        );
        if (i < n - 1) {
            const x1 = x + boxW;
            const x2 = x + boxW + gap;
            const ym = yBox + boxH / 2;
            parts.push(
                `<line x1="${x1}" y1="${ym}" x2="${x2 - 2}" y2="${ym}" stroke="#475569" stroke-width="2" marker-end="url(#${markerId})"/>`
            );
        }
    }
    parts.push('</svg>');
    return parts.join('\n');
}

function splitDelimitedBlocks(raw: string, kind: 'SCREEN' | 'TSX'): string[] {
    const re = new RegExp(`---${kind}_(\\d+)---`, 'gi');
    const parts = raw.trim().split(re);
    const blocks: string[] = [];
    for (let i = 2; i < parts.length; i += 2) {
        const chunk = parts[i]?.trim();
        if (chunk) blocks.push(chunk);
    }
    return blocks;
}

/** Diagrama de user flow (SVG) a partir del spec de plataforma + solución aprobada. */
export async function generateUserFlow(
    specMarkdown: string,
    solution: IdeationSolutionDto,
    opts?: { feedback?: string; priorSvg?: string }
): Promise<string> {
    const user = buildUserFlowSvgUserPrompt({
        specMarkdown,
        solutionJson: JSON.stringify(solution).slice(0, 24_000),
        feedback: opts?.feedback,
        priorSvg: opts?.priorSvg,
    });
    const raw = await generateTextWithRetries(USER_FLOW_SVG_SYSTEM, user, 0.35, { maxOutputTokens: 16_384 });
    const logPreview = 5000;
    console.log(
        '[generateUserFlow] respuesta Gemini (preview, primeros',
        logPreview,
        'chars):\n',
        raw.slice(0, logPreview),
        raw.length > logPreview ? '\n… [log truncado] …' : '',
        '\n[generateUserFlow] longitud total (chars):',
        raw.length
    );
    try {
        return extractFirstSvg(raw);
    } catch (e1) {
        console.warn('[generateUserFlow] extractFirstSvg (1.er intento):', (e1 as Error)?.message ?? e1);
        const repair =
            `${user}\n\n## Corrección requerida\nLa respuesta anterior no incluyó un único SVG válido (exactamente un bloque desde <svg hasta </svg>). Emití de nuevo **solo** ese fragmento, sin markdown ni texto fuera del SVG.`;
        const raw2 = await generateTextWithRetries(USER_FLOW_SVG_SYSTEM, repair, 0.2, { maxOutputTokens: 16_384 });
        console.log(
            '[generateUserFlow] respuesta Gemini 2º intento (preview, primeros',
            logPreview,
            'chars):\n',
            raw2.slice(0, logPreview),
            raw2.length > logPreview ? '\n… [log truncado] …' : '',
            '\n[generateUserFlow] longitud total 2º intento:',
            raw2.length
        );
        try {
            return extractFirstSvg(raw2);
        } catch (e2) {
            console.warn(
                '[generateUserFlow] extractFirstSvg (2º intento) falló; se usa SVG de respaldo. Motivo:',
                (e2 as Error)?.message ?? e2
            );
            return buildFallbackUserFlowSvg(solution);
        }
    }
}

export async function iterateUserFlowChat(input: {
    specMarkdown: string;
    solution: IdeationSolutionDto;
    currentSvg: string;
    history: { role: 'user' | 'assistant'; text: string }[];
    userMessage: string;
}): Promise<string> {
    const hist = input.history
        .slice(-12)
        .map((h) => `${h.role === 'user' ? 'Usuario' : 'Agente'}: ${h.text}`)
        .join('\n');
    const user = buildUserFlowChatUserPrompt({
        specMarkdown: input.specMarkdown,
        solutionJson: JSON.stringify(input.solution).slice(0, 16_000),
        currentSvgSnippet: input.currentSvg.slice(0, 12_000),
        historyLines: hist,
        userMessage: input.userMessage,
    });
    const reply = await generateTextWithRetries(USER_FLOW_CHAT_SYSTEM, user, 0.45, { maxOutputTokens: 2048 });
    return reply.trim();
}

/** Wireframes HiFi (HTML) de todas las pantallas, delimitados ---SCREEN_N---. */
export async function generateFullFlowWireframes(
    specMarkdown: string,
    solution: IdeationSolutionDto,
    opts?: { feedback?: string }
): Promise<string> {
    const screens = pseudoScreensFromIdeationSolution(solution);
    const user = buildFullFlowHifiUserPrompt({
        specMarkdown,
        screensJson: JSON.stringify(screens).slice(0, 24_000),
        feedback: opts?.feedback,
    });
    const raw = await generateTextWithRetries(FULL_FLOW_HIFI_HTML_SYSTEM, user, 0.35, { maxOutputTokens: 24_576 });
    const blocks = splitDelimitedBlocks(raw, 'SCREEN');
    if (blocks.length === 0) {
        throw new Error('El modelo no devolvió bloques ---SCREEN_N--- parseables.');
    }
    return raw.trim();
}

/** Código TSX con MUI v5 por pantalla, delimitado ---TSX_N---. */
export async function generateTsxMuiScreens(
    specMarkdown: string,
    hifiHtmlScreens: string[],
    opts?: { feedback?: string }
): Promise<string[]> {
    if (!hifiHtmlScreens.length) throw new Error('Faltan wireframes HiFi para generar TSX.');
    const joined = hifiHtmlScreens
        .map((html, i) => `### Pantalla ${i + 1}\n${html}`)
        .join('\n\n')
        .slice(0, 120_000);
    const fb = opts?.feedback?.trim();
    const user =
        buildTsxMuiUserPrompt({ specMarkdown, screensHtmlJoined: joined }) +
        (fb ? `\n\n## Feedback del usuario para esta iteración\n${fb.slice(0, 8000)}` : '');
    const raw = await generateTextWithRetries(TSX_MUI_SCREENS_SYSTEM, user, 0.25, { maxOutputTokens: 24_576 });
    const blocks = splitDelimitedBlocks(raw, 'TSX');
    if (blocks.length === 0) {
        throw new Error('El modelo no devolvió bloques ---TSX_N--- parseables.');
    }
    return blocks;
}

export type FigmaScreenMetaForHandoff = { screenIndex: number; nodeId: string; name: string };

/** TSX final alineado a Figma (capturas PNG opcionales + metadata). */
export async function generateTsxFromFigma(
    specMarkdown: string,
    hifiHtmlScreens: string[],
    input: {
        figmaFileUrl: string;
        screensMeta: FigmaScreenMetaForHandoff[];
        feedback?: string;
    },
    opts?: { screenSnapshots?: (Buffer | null)[] }
): Promise<string[]> {
    if (!input.screensMeta.length) throw new Error('Falta metadata de pantallas Figma.');
    const joined = hifiHtmlScreens
        .map((html, i) => `### Pantalla ${i + 1}\n${html}`)
        .join('\n\n')
        .slice(0, 120_000);
    const metaJson = JSON.stringify(input.screensMeta).slice(0, 16_000);
    const baseText = buildTsxFromFigmaUserPrompt({
        specMarkdown,
        figmaFileUrl: input.figmaFileUrl,
        screensMetaJson: metaJson,
        hifiHtmlJoined: joined,
        feedback: input.feedback,
    });

    const snaps = opts?.screenSnapshots;
    const hasAnyPng = Boolean(snaps?.some((b) => b && b.length > 0));

    let raw: string;
    if (hasAnyPng && snaps && snaps.length > 0) {
        const parts: Part[] = [
            { text: baseText },
            { text: '\n\n## Capturas exportadas desde Figma (PNG, una por pantalla en orden)\n' },
        ];
        for (let i = 0; i < snaps.length; i++) {
            const buf = snaps[i];
            parts.push({ text: `\n### Pantalla ${i + 1}\n` });
            if (buf && buf.length > 0) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: buf.toString('base64'),
                    },
                });
            } else {
                parts.push({ text: '(sin PNG para esta pantalla; usá metadata + HTML.)\n' });
            }
        }
        raw = await generateMultimodalTextWithRetries(TSX_FROM_FIGMA_SCREENS_SYSTEM, parts, 0.22, {
            maxOutputTokens: 24_576,
        });
    } else {
        raw = await generateTextWithRetries(TSX_FROM_FIGMA_SCREENS_SYSTEM, baseText, 0.22, { maxOutputTokens: 24_576 });
    }

    const blocks = splitDelimitedBlocks(raw, 'TSX');
    if (blocks.length === 0) {
        throw new Error('El modelo no devolvió bloques ---TSX_N--- parseables (Figma).');
    }
    return blocks;
}

/** Descarga PNG desde la API de Figma para enriquecer generateTsxFromFigma. */
export async function loadFigmaSnapshotsForTsx(
    figmaFileUrl: string,
    screensMeta: FigmaScreenMetaForHandoff[]
): Promise<(Buffer | null)[] | undefined> {
    const token = config.FIGMA_ACCESS_TOKEN?.trim();
    if (!token) return undefined;
    const parsed = parseFigmaDesignUrl(figmaFileUrl);
    if (!parsed) return undefined;
    try {
        return await fetchFigmaScreenPngs(parsed.fileKey, screensMeta, token);
    } catch (e) {
        console.warn('loadFigmaSnapshotsForTsx: omitiendo capturas:', (e as Error)?.message ?? e);
        return undefined;
    }
}

// --- Handoff ZIP (README, theme, routes, endpoints + pantallas + SVG) ---

export type HandoffZipInput = {
    initiativeName: string;
    executiveSummary: string;
    /** Spec legible derivado del análisis UX. */
    analysisMarkdown: string;
    userFlowSvg: string;
    hifiHtmlScreens: string[];
    tsxScreens: string[];
    flowStepLabels: string[];
    availableEndpoints?: ApiEndpointDescriptor[];
    tsxSource?: 'figma' | 'wireframes';
    figmaFileUrl?: string;
    figmaScreensMeta?: FigmaScreenMetaForHandoff[];
};

function buildHandoffZipLlmUserPrompt(input: HandoffZipInput): string {
    const n = Math.max(1, input.tsxScreens.length);
    const sampleHtml = (input.hifiHtmlScreens[0] ?? '').slice(0, 10_000);
    const sampleTsx = (input.tsxScreens[0] ?? '').slice(0, 10_000);
    const epJson = JSON.stringify(input.availableEndpoints ?? []).slice(0, 16_000);
    const steps = input.flowStepLabels.slice(0, 24).map((s, i) => `${i + 1}. ${s}`).join('\n');
    return [
        `## Iniciativa\n${input.initiativeName}`,
        '',
        '## Resumen ejecutivo',
        input.executiveSummary.slice(0, 8000),
        '',
        '## Análisis (Markdown)',
        input.analysisMarkdown.slice(0, 24_000),
        '',
        `## Flujo (${n} pantallas)`,
        steps || '(sin etiquetas; usá Pantalla 1..N)',
        '',
        '## Endpoints conocidos (JSON; puede estar vacío)',
        epJson,
        '',
        '## Muestra wireframe HiFi (HTML, truncado)',
        sampleHtml || '(sin HTML)',
        '',
        '## Muestra TSX MUI (truncado)',
        sampleTsx || '(sin TSX)',
        '',
        (input.tsxSource ?? 'wireframes') === 'figma'
            ? '## Fuente de diseño\nLos TSX del ZIP fueron generados a partir de Figma (metadata + capturas opcionales). Incluí en el README una sección breve con el link al archivo Figma y la tabla screenIndex / nodeId / name.'
            : '## Fuente de diseño\nLos TSX se generaron desde wireframes HiFi (modo legado) si no hubo paso Figma aprobado.',
        input.figmaFileUrl?.trim()
            ? `## Link archivo Figma\n${input.figmaFileUrl.trim().slice(0, 2000)}`
            : '',
        input.figmaScreensMeta?.length
            ? `## Metadata Figma (JSON truncado)\n${JSON.stringify(input.figmaScreensMeta).slice(0, 8000)}`
            : '',
        `## Cantidad de archivos en screens/\nExactamente ${n} archivos: Pantalla1.tsx … Pantalla${n}.tsx.`,
    ]
        .filter((x) => x !== '')
        .join('\n');
}

function parseHandoffZipBundleJson(raw: string): {
    readme: string;
    themeTs: string;
    routesTsx: string;
    endpointsTs: string;
} {
    let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Handoff bundle: JSON no encontrado.');
    t = t.slice(start, end + 1);
    const parsed = JSON.parse(t) as Record<string, unknown>;
    const req = (k: string) => (typeof parsed[k] === 'string' ? (parsed[k] as string).trim() : '');
    const readme = req('readme');
    const themeTs = req('themeTs');
    const routesTsx = req('routesTsx');
    const endpointsTs = req('endpointsTs');
    if (!readme || !themeTs || !routesTsx || !endpointsTs) {
        throw new Error('Handoff bundle: faltan claves readme, themeTs, routesTsx o endpointsTs.');
    }
    return { readme, themeTs, routesTsx, endpointsTs };
}

async function generateHandoffBundleWithLlm(input: HandoffZipInput): Promise<{
    readme: string;
    themeTs: string;
    routesTsx: string;
    endpointsTs: string;
}> {
    const user = buildHandoffZipLlmUserPrompt(input);
    let raw: string;
    try {
        raw = await generateTextWithRetries(HANDOFF_BUNDLE_SYSTEM, user, 0.28, {
            maxOutputTokens: 16_384,
            responseMimeType: 'application/json',
        });
    } catch (e) {
        console.warn('Handoff bundle: reintentando sin responseMimeType JSON:', (e as Error)?.message ?? e);
        raw = await generateTextWithRetries(HANDOFF_BUNDLE_SYSTEM, user, 0.28, { maxOutputTokens: 16_384 });
    }
    return parseHandoffZipBundleJson(raw);
}

function buildFallbackHandoffArtifacts(input: HandoffZipInput): {
    readme: string;
    themeTs: string;
    routesTsx: string;
    endpointsTs: string;
} {
    const n = Math.max(1, input.tsxScreens.length);
    const lines = input.flowStepLabels.length
        ? input.flowStepLabels.map((t, i) => `| ${i + 1} | ${t.replace(/\|/g, '/')} |`)
        : Array.from({ length: n }, (_, i) => `| ${i + 1} | Pantalla ${i + 1} |`);
    const readme = [
        `# Handoff — ${input.initiativeName}`,
        '',
        '## Setup',
        '',
        '1. Node.js 20+',
        '2. `npm install react react-dom react-router-dom@6 @mui/material @emotion/react @emotion/styled`',
        '3. Copiá `theme.ts` y aplicá `ThemeProvider` + `CssBaseline` en tu `App`.',
        '4. Importá y montá el componente exportado por `routes.tsx` dentro de `BrowserRouter`.',
        '',
        '## Pantallas',
        '',
        '| # | Descripción |',
        '|---|-------------|',
        ...lines,
        '',
        '## User flow',
        '',
        'El archivo `user-flow.svg` resume transiciones; alinealo con las rutas en `routes.tsx`.',
        '',
        '## API',
        '',
        'Revisá `api/endpoints.ts` (endpoints documentados o inferidos del flujo).',
        ...(input.figmaFileUrl?.trim()
            ? [
                  '',
                  '## Diseño final (Figma)',
                  '',
                  `- Archivo: ${input.figmaFileUrl.trim()}`,
                  `- Fuente TSX declarada: ${(input.tsxSource ?? 'wireframes') === 'figma' ? 'Figma' : 'Wireframes HiFi (legado)'}`,
                  '',
                  'Detalle por pantalla en `figma-metadata.json`.',
              ]
            : []),
    ].join('\n');

    const themeTs = `import { createTheme } from '@mui/material/styles';

/** Tema base inferido para handoff; ajustá palette/typography con el design system final. */
export const handoffTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2563eb' },
        secondary: { main: '#64748b' },
        background: { default: '#f8fafc', paper: '#ffffff' },
    },
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: { fontSize: '1.75rem', fontWeight: 600 },
        body1: { fontSize: '0.95rem' },
    },
    shape: { borderRadius: 10 },
});

export default handoffTheme;
`;

    const imports = Array.from({ length: n }, (_, i) => `import Pantalla${i + 1} from './screens/Pantalla${i + 1}';`).join(
        '\n'
    );
    const routes = Array.from(
        { length: n },
        (_, i) =>
            `      <Route path="/pantalla/${i + 1}" element={<Pantalla${i + 1} />} />`
    ).join('\n');
    const routesTsx = `import { Routes, Route, Navigate } from 'react-router-dom';
${imports}

/** Rutas alineadas al flujo (orden Pantalla 1 → ${n}). */
export default function HandoffRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/pantalla/1" replace />} />
${routes}
            <Route path="*" element={<Navigate to="/pantalla/1" replace />} />
        </Routes>
    );
}
`;

    const inferred =
        input.availableEndpoints && input.availableEndpoints.length > 0
            ? input.availableEndpoints.map(
                  (e) =>
                      `  { method: '${e.method.replace(/'/g, "\\'")}', path: '${e.path.replace(/'/g, "\\'")}', summary: '${(e.summary ?? '').replace(/'/g, "\\'")}' },`
              )
            : Array.from({ length: n }, (_, i) => {
                  const label = (input.flowStepLabels[i] ?? `Paso ${i + 1}`).replace(/'/g, "\\'");
                  return `  { method: 'GET', path: '/api/flow/step/${i + 1}', summary: '${label} (inferido del flujo)' },`;
              });

    const endpointsTs = `/**
 * Endpoints disponibles o inferidos para integración con las pantallas del handoff.
 * Reemplazá stubs por llamadas reales (fetch/axios) según tu backend.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
    method: HttpMethod;
    path: string;
    summary?: string;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
${inferred.join('\n')}
];

export function listEndpointsForDocs(): string {
    return API_ENDPOINTS.map((e) => \`- \${e.method} \${e.path}\${e.summary ? ' — ' + e.summary : ''}\`).join('\\n');
}
`;

    return { readme, themeTs, routesTsx, endpointsTs };
}

/**
 * Genera un ZIP con README, theme, rutas, pantallas TSX, capa API y user-flow.svg.
 */
export async function generateHandoffZip(input: HandoffZipInput): Promise<Buffer> {
    let readme: string;
    let themeTs: string;
    let routesTsx: string;
    let endpointsTs: string;
    try {
        const b = await generateHandoffBundleWithLlm(input);
        readme = b.readme;
        themeTs = b.themeTs;
        routesTsx = b.routesTsx;
        endpointsTs = b.endpointsTs;
    } catch (e) {
        console.warn('generateHandoffZip: usando plantillas fallback:', (e as Error)?.message ?? e);
        const fb = buildFallbackHandoffArtifacts(input);
        readme = fb.readme;
        themeTs = fb.themeTs;
        routesTsx = fb.routesTsx;
        endpointsTs = fb.endpointsTs;
    }

    const zip = new JSZip();
    const root = zip.folder('handoff');
    if (!root) throw new Error('No se pudo crear la carpeta handoff/ en el ZIP.');

    root.file('README.md', readme);
    root.file('theme.ts', themeTs);
    root.file('routes.tsx', routesTsx);
    root.file('user-flow.svg', input.userFlowSvg?.trim() || '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><text x="20" y="70" font-size="16">User flow no disponible</text></svg>');

    const screens = root.folder('screens');
    const apiFolder = root.folder('api');
    if (!screens || !apiFolder) throw new Error('Estructura interna del ZIP inválida.');

    const n = Math.max(1, input.tsxScreens.length);
    for (let i = 0; i < n; i++) {
        const code = input.tsxScreens[i] ?? '// Pantalla vacía\nexport default function Placeholder() { return null; }\n';
        screens.file(`Pantalla${i + 1}.tsx`, code);
    }
    apiFolder.file('endpoints.ts', endpointsTs);

    if (input.figmaFileUrl?.trim() || (input.figmaScreensMeta && input.figmaScreensMeta.length > 0)) {
        root.file(
            'figma-metadata.json',
            JSON.stringify(
                {
                    figmaFileUrl: input.figmaFileUrl ?? null,
                    tsxSource: input.tsxSource ?? 'wireframes',
                    screens: input.figmaScreensMeta ?? [],
                },
                null,
                2
            )
        );
    }

    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return Buffer.from(out);
}