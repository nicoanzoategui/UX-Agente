import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/require-auth.js';
import { understandingUploadFields } from '../middleware/understanding-upload.js';
import {
    generateFullFlowWireframes,
    generateIdeationSolutions,
    generatePrototypeFlowScreens,
    generatePrototypeIterationReply,
    generateSolutionIterationReply,
    generateSpecWithPromptC,
    generateStepEWireframeOptions,
    generateTsxMuiScreens,
    generateTsxFromFigma,
    loadFigmaSnapshotsForTsx,
    generateHandoffZip,
    generateUnderstandingAnalysis,
    generateUserFlow,
    iterateUserFlowChat,
    type IdeationSolutionDto,
    type PrototypeScreenSpecDto,
    type UnderstandingAnalysisResult,
} from '../services/llm.service.js';
import { generateFigmaFromWireframes } from '../services/figma.service.js';

const router = Router();

function buildAnalysisMarkdownForHandoff(a: UnderstandingAnalysisResult): string {
    const blocks: string[] = [
        `### Síntesis de contexto\n${a.contextSynthesis?.trim() || '—'}`,
        `### Objetivos de negocio\n${a.businessObjectives?.length ? a.businessObjectives.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Insights\n${a.keyInsights?.length ? a.keyInsights.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Pain points\n${a.userPainPoints?.length ? a.userPainPoints.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Oportunidades\n${a.opportunities?.length ? a.opportunities.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Riesgos y restricciones\n${a.risksAndConstraints?.length ? a.risksAndConstraints.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Preguntas abiertas\n${a.openQuestions?.length ? a.openQuestions.map((x) => `- ${x}`).join('\n') : '—'}`,
        `### Foco sugerido para ideación\n${a.suggestedFocusForIdeation?.trim() || '—'}`,
    ];
    if (a.availableEndpoints?.length) {
        blocks.push(
            `### Endpoints documentados (API)\n${a.availableEndpoints
                .map((e) => `- **${e.method}** \`${e.path}\`${e.summary ? ` — ${e.summary}` : ''}`)
                .join('\n')}`
        );
    }
    return blocks.join('\n\n');
}

router.use(requireAuth);

function safeParseFileManifest(raw: unknown): { name: string; tag: string; sizeBytes?: number }[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
        const p = JSON.parse(raw) as unknown;
        if (!Array.isArray(p)) return [];
        return p
            .filter((x) => x && typeof x === 'object')
            .map((x) => x as Record<string, unknown>)
            .map((x) => ({
                name: typeof x.name === 'string' ? x.name : 'sin nombre',
                tag: typeof x.tag === 'string' ? x.tag : 'Documento',
                sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : undefined,
            }));
    } catch {
        return [];
    }
}

/** POST /api/generate-wireframes — Paso E: 3 wireframes baja fidelidad responsivos desde spec refinado (orquestador). */
router.post('/generate-wireframes', async (req, res) => {
    const { specText } = req.body as { specText?: string };

    if (!specText?.trim()) {
        return res.status(400).json({ error: 'Enviá specText en el body (spec refinado del Paso C).' });
    }

    try {
        const options = await generateStepEWireframeOptions(specText.trim());
        res.json({ success: true, options });
    } catch (error) {
        console.error('Error en Paso E (generate-wireframes):', error);
        const msg = (error as Error)?.message || 'Error generando wireframes';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/analyze-understanding — Paso 2: análisis de contexto con Gemini (multipart). */
router.post(
    '/analyze-understanding',
    (req, res, next) => {
        understandingUploadFields(req, res, (err: unknown) => {
            if (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Archivo demasiado grande (máx 20 MB)' });
                }
                return res.status(400).json({ error: msg || 'Archivo no válido' });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            const initiativeName = String(req.body?.initiativeName ?? '').trim();
            if (!initiativeName) {
                return res.status(400).json({ error: 'El nombre de la iniciativa es obligatorio.' });
            }
            const jiraTicket = String(req.body?.jiraTicket ?? '').trim();
            const squad = String(req.body?.squad ?? '').trim();
            const notes = String(req.body?.notes ?? '').trim();
            const fileManifest = safeParseFileManifest(req.body?.fileManifest);

            const mapFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
            const contextFiles = mapFiles?.contextFiles ?? [];
            const screenshots = mapFiles?.screenshots ?? [];
            const apiSpecFile = mapFiles?.apiSpec?.[0];

            const analysis = await generateUnderstandingAnalysis({
                initiativeName,
                jiraTicket,
                squad,
                notes,
                fileManifest,
                contextFiles: contextFiles.map((f) => ({
                    buffer: f.buffer,
                    originalName: f.originalname,
                    mimeType: f.mimetype,
                })),
                screenshots: screenshots.map((f) => ({
                    buffer: f.buffer,
                    originalName: f.originalname,
                    mimeType: f.mimetype,
                })),
                apiSpec: apiSpecFile
                    ? {
                          buffer: apiSpecFile.buffer,
                          originalName: apiSpecFile.originalname,
                          mimeType: apiSpecFile.mimetype,
                      }
                    : null,
            });

            res.json({ success: true, analysis });
        } catch (error) {
            console.error('Error en analyze-understanding:', error);
            const msg = (error as Error)?.message || 'Error al analizar el contexto';
            res.status(500).json({ error: msg });
        }
    }
);

function isUnderstandingAnalysis(a: unknown): a is UnderstandingAnalysisResult {
    return Boolean(a && typeof a === 'object' && typeof (a as UnderstandingAnalysisResult).executiveSummary === 'string');
}

function parseIdeationSolutionBody(x: unknown): IdeationSolutionDto | null {
    if (!x || typeof x !== 'object') return null;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const flowSteps = Array.isArray(o.flowSteps)
        ? (o.flowSteps as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    if (!title || flowSteps.length < 3) return null;
    const howItSolves = Array.isArray(o.howItSolves)
        ? (o.howItSolves as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    const expectedImpact = Array.isArray(o.expectedImpact)
        ? (o.expectedImpact as unknown[]).filter((s) => typeof s === 'string').map((s) => (s as string).trim())
        : [];
    return {
        title,
        recommendedByAi: o.recommendedByAi === true,
        flowSteps,
        howItSolves: howItSolves.length ? howItSolves : ['—'],
        expectedImpact: expectedImpact.length ? expectedImpact : ['—'],
    };
}

function buildPlatformSpecMarkdown(body: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    analysis: UnderstandingAnalysisResult;
    solution: IdeationSolutionDto;
}): string {
    return [
        `# ${body.initiativeName}`,
        `Jira: ${body.jiraTicket || '—'}`,
        `Squad: ${body.squad || '—'}`,
        '',
        '## Análisis (JSON)',
        JSON.stringify(body.analysis),
        '',
        '## Solución elegida (JSON)',
        JSON.stringify(body.solution),
    ].join('\n');
}

function parsePrototypeScreensBody(x: unknown): PrototypeScreenSpecDto[] | null {
    if (!Array.isArray(x) || x.length !== 6) return null;
    const out: PrototypeScreenSpecDto[] = [];
    for (const item of x) {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        const title = typeof o.title === 'string' ? o.title.trim() : '';
        if (!title) return null;
        const subtitle = typeof o.subtitle === 'string' ? o.subtitle.trim() : undefined;
        const note = typeof o.note === 'string' ? o.note.trim() : undefined;
        const cta = typeof o.cta === 'string' ? o.cta.trim() : undefined;
        const bullets = Array.isArray(o.bullets)
            ? (o.bullets as unknown[]).filter((b) => typeof b === 'string').map((b) => (b as string).trim())
            : undefined;
        out.push({
            title,
            ...(subtitle ? { subtitle } : {}),
            ...(bullets?.length ? { bullets } : {}),
            ...(note ? { note } : {}),
            ...(cta ? { cta } : {}),
        });
    }
    return out;
}

/** POST /api/generate-ideation-solutions — 3 propuestas desde el análisis JSON. */
router.post('/generate-ideation-solutions', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) {
        return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis debe ser el objeto devuelto por analyze-understanding.' });
    }
    try {
        const solutions = await generateIdeationSolutions({
            initiativeName,
            jiraTicket: String(body.jiraTicket ?? '').trim(),
            squad: String(body.squad ?? '').trim(),
            analysis: body.analysis,
        });
        res.json({ success: true, solutions });
    } catch (error) {
        console.error('Error en generate-ideation-solutions:', error);
        const msg = (error as Error)?.message || 'Error generando ideación';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/iterate-solution — mensaje de chat para refinar una solución. */
router.post('/iterate-solution', async (req, res) => {
    const body = req.body as {
        solution?: unknown;
        initiativeName?: string;
        analysis?: unknown;
        history?: unknown;
        userMessage?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    const userMessage = String(body.userMessage ?? '').trim();
    if (!initiativeName || !userMessage) {
        return res.status(400).json({ error: 'initiativeName y userMessage son obligatorios.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) {
        return res.status(400).json({ error: 'solution inválida (objeto completo con title y flowSteps).' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const histRaw = Array.isArray(body.history) ? body.history : [];
    const history: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const h of histRaw) {
        if (!h || typeof h !== 'object') continue;
        const o = h as Record<string, unknown>;
        const role = o.role === 'assistant' ? 'assistant' : o.role === 'user' ? 'user' : null;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (role && text) history.push({ role, text });
    }
    try {
        const { reply, refinedSolution } = await generateSolutionIterationReply({
            solution,
            initiativeName,
            analysis: body.analysis,
            history,
            userMessage,
        });
        res.json({ success: true, reply, refinedSolution });
    } catch (error) {
        console.error('Error en iterate-solution:', error);
        const msg = (error as Error)?.message || 'Error en la iteración';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/iterate-prototype — chat para refinar el prototipo antes de regenerar pantallas. */
router.post('/iterate-prototype', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        analysis?: unknown;
        solution?: unknown;
        screens?: unknown;
        history?: unknown;
        userMessage?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    const userMessage = String(body.userMessage ?? '').trim();
    if (!initiativeName || !userMessage) {
        return res.status(400).json({ error: 'initiativeName y userMessage son obligatorios.' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) {
        return res.status(400).json({ error: 'solution inválida.' });
    }
    const screens = parsePrototypeScreensBody(body.screens);
    if (!screens) {
        return res.status(400).json({ error: 'screens debe ser un array de exactamente 6 pantallas.' });
    }
    const histRaw = Array.isArray(body.history) ? body.history : [];
    const history: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const h of histRaw) {
        if (!h || typeof h !== 'object') continue;
        const o = h as Record<string, unknown>;
        const role = o.role === 'assistant' ? 'assistant' : o.role === 'user' ? 'user' : null;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (role && text) history.push({ role, text });
    }
    try {
        const reply = await generatePrototypeIterationReply({
            initiativeName,
            solution,
            screens,
            history,
            userMessage,
        });
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Error en iterate-prototype:', error);
        const msg = (error as Error)?.message || 'Error en la iteración del prototipo';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-prototype-screens — 6 pantallas de baja fidelidad alineadas a solución + iteración. */
router.post('/generate-prototype-screens', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        iterationMessages?: unknown;
        existingScreens?: unknown;
        prototypeIterationMessages?: unknown;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) {
        return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) {
        return res.status(400).json({ error: 'solution debe incluir title y al menos 3 flowSteps.' });
    }
    const msgRaw = Array.isArray(body.iterationMessages) ? body.iterationMessages : [];
    const iterationMessages: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const m of msgRaw) {
        if (!m || typeof m !== 'object') continue;
        const o = m as Record<string, unknown>;
        const role = o.role === 'assistant' ? 'assistant' : o.role === 'user' ? 'user' : null;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (role && text) iterationMessages.push({ role, text });
    }
    const existingScreens = parsePrototypeScreensBody(body.existingScreens);
    const protoRaw = Array.isArray(body.prototypeIterationMessages) ? body.prototypeIterationMessages : [];
    const prototypeIterationMessages: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const m of protoRaw) {
        if (!m || typeof m !== 'object') continue;
        const o = m as Record<string, unknown>;
        const role = o.role === 'assistant' ? 'assistant' : o.role === 'user' ? 'user' : null;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (role && text) prototypeIterationMessages.push({ role, text });
    }
    try {
        const result = await generatePrototypeFlowScreens({
            initiativeName,
            jiraTicket: String(body.jiraTicket ?? '').trim(),
            squad: String(body.squad ?? '').trim(),
            analysis: body.analysis,
            solution,
            iterationMessages,
            ...(existingScreens ? { existingScreens } : {}),
            ...(prototypeIterationMessages.length ? { prototypeIterationMessages } : {}),
        });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error en generate-prototype-screens:', error);
        const msg = (error as Error)?.message || 'Error generando prototipo';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-user-flow — SVG de user flow a partir del análisis + solución aprobada (sin prototipo previo). */
router.post('/generate-user-flow', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        feedback?: string;
        currentSvg?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const specMd = buildPlatformSpecMarkdown({
        initiativeName,
        jiraTicket: String(body.jiraTicket ?? '').trim(),
        squad: String(body.squad ?? '').trim(),
        analysis: body.analysis,
        solution,
    });
    const feedback = String(body.feedback ?? '').trim() || undefined;
    const currentSvg = String(body.currentSvg ?? '').trim() || undefined;
    try {
        const svg = await generateUserFlow(specMd, solution, {
            feedback,
            priorSvg: currentSvg,
        });
        res.json({ success: true, svg });
    } catch (error) {
        const err = error as Error;
        console.error('[generate-user-flow] fallo:', err?.message ?? error);
        console.error('[generate-user-flow] stack:', err?.stack ?? '(sin stack)');
        console.error('[generate-user-flow] contexto:', {
            initiativeName,
            specMarkdownChars: specMd.length,
            solutionTitle: solution.title,
            flowSteps: solution.flowSteps.length,
            hasFeedback: Boolean(feedback),
            hasPriorSvg: Boolean(currentSvg),
        });
        const msg = err?.message || 'Error generando user flow';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/iterate-user-flow-chat — chat sin regenerar SVG. */
router.post('/iterate-user-flow-chat', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        currentSvg?: string;
        history?: unknown;
        userMessage?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    const userMessage = String(body.userMessage ?? '').trim();
    if (!initiativeName || !userMessage) {
        return res.status(400).json({ error: 'initiativeName y userMessage son obligatorios.' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const currentSvg = String(body.currentSvg ?? '').trim();
    if (!currentSvg) return res.status(400).json({ error: 'currentSvg es obligatorio.' });
    const histRaw = Array.isArray(body.history) ? body.history : [];
    const history: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const h of histRaw) {
        if (!h || typeof h !== 'object') continue;
        const o = h as Record<string, unknown>;
        const role = o.role === 'assistant' ? 'assistant' : o.role === 'user' ? 'user' : null;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (role && text) history.push({ role, text });
    }
    const specMd = buildPlatformSpecMarkdown({
        initiativeName,
        jiraTicket: String(body.jiraTicket ?? '').trim(),
        squad: String(body.squad ?? '').trim(),
        analysis: body.analysis,
        solution,
    });
    try {
        const reply = await iterateUserFlowChat({
            specMarkdown: specMd,
            solution,
            currentSvg,
            history,
            userMessage,
        });
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Error en iterate-user-flow-chat:', error);
        const msg = (error as Error)?.message || 'Error en el chat';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-full-flow-hifi — wireframes HiFi de todas las pantallas (---SCREEN_N---). */
router.post('/generate-full-flow-hifi', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        feedback?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const specMd = buildPlatformSpecMarkdown({
        initiativeName,
        jiraTicket: String(body.jiraTicket ?? '').trim(),
        squad: String(body.squad ?? '').trim(),
        analysis: body.analysis,
        solution,
    });
    const feedback = String(body.feedback ?? '').trim() || undefined;
    try {
        const raw = await generateFullFlowWireframes(specMd, solution, { feedback });
        res.json({ success: true, raw });
    } catch (error) {
        console.error('Error en generate-full-flow-hifi:', error);
        const msg = (error as Error)?.message || 'Error generando wireframes HiFi';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-tsx-mui-screens — TSX MUI por pantalla (---TSX_N---). */
router.post('/generate-tsx-mui-screens', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        hifiHtmlScreens?: unknown;
        feedback?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const specMd = buildPlatformSpecMarkdown({
        initiativeName,
        jiraTicket: String(body.jiraTicket ?? '').trim(),
        squad: String(body.squad ?? '').trim(),
        analysis: body.analysis,
        solution,
    });
    const rawScreens = body.hifiHtmlScreens;
    if (!Array.isArray(rawScreens) || rawScreens.length === 0) {
        return res.status(400).json({ error: 'hifiHtmlScreens debe ser un array de strings HTML no vacío.' });
    }
    const hifiHtmlScreens = rawScreens
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim());
    if (hifiHtmlScreens.length === 0) {
        return res.status(400).json({ error: 'hifiHtmlScreens no tiene entradas válidas.' });
    }
    const feedback = String(body.feedback ?? '').trim() || undefined;
    try {
        const tsxScreens = await generateTsxMuiScreens(specMd, hifiHtmlScreens, { feedback });
        res.json({ success: true, tsxScreens });
    } catch (error) {
        console.error('Error en generate-tsx-mui-screens:', error);
        const msg = (error as Error)?.message || 'Error generando TSX';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-figma-from-wireframes — prepara metadata de pantallas para etapa Figma. */
router.post('/generate-figma-from-wireframes', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        analysis?: unknown;
        solution?: unknown;
        hifiWireframesHtml?: unknown;
        designSystemUrl?: string;
        destinationUrl?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const rawScreens = body.hifiWireframesHtml;
    const hifiWireframesHtml = Array.isArray(rawScreens)
        ? (rawScreens as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
    if (hifiWireframesHtml.length === 0) {
        return res.status(400).json({ error: 'hifiWireframesHtml debe ser un array de strings no vacío.' });
    }
    const designSystemUrl = String(body.designSystemUrl ?? '').trim();
    const destinationUrl = String(body.destinationUrl ?? '').trim();
    if (!designSystemUrl || !destinationUrl) {
        return res.status(400).json({ error: 'designSystemUrl y destinationUrl son obligatorios.' });
    }
    try {
        const out = await generateFigmaFromWireframes({
            initiativeName,
            hifiWireframesHtml,
            solutionFlowSteps: solution.flowSteps,
            designSystemUrl,
            destinationUrl,
        });
        res.json({
            success: true,
            figmaFileUrl: out.figmaFileUrl,
            figmaFileKey: out.figmaFileKey,
            screens: out.screens,
            logs: out.logs,
            errors: out.errors,
            figmaApiUsed: out.figmaApiUsed,
        });
    } catch (error) {
        console.error('Error en generate-figma-from-wireframes:', error);
        const msg = (error as Error)?.message || 'Error preparando salida para Figma';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-tsx-from-figma — TSX MUI por pantalla usando metadata Figma (+ PNG API si hay token). */
router.post('/generate-tsx-from-figma', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        jiraTicket?: string;
        squad?: string;
        analysis?: unknown;
        solution?: unknown;
        figmaFileUrl?: string;
        figmaScreensMeta?: unknown;
        hifiWireframesHtml?: unknown;
        feedback?: string;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const solution = parseIdeationSolutionBody(body.solution);
    if (!solution) return res.status(400).json({ error: 'solution inválida.' });
    const figmaFileUrl = String(body.figmaFileUrl ?? '').trim();
    if (!figmaFileUrl) return res.status(400).json({ error: 'figmaFileUrl es obligatorio.' });
    const rawMeta = body.figmaScreensMeta;
    const figmaScreensMeta = Array.isArray(rawMeta)
        ? (rawMeta as unknown[])
              .filter((x) => x && typeof x === 'object')
              .map((x) => x as Record<string, unknown>)
              .filter(
                  (x) =>
                      typeof x.screenIndex === 'number' &&
                      typeof x.nodeId === 'string' &&
                      typeof x.name === 'string'
              )
              .map((x) => ({
                  screenIndex: x.screenIndex as number,
                  nodeId: x.nodeId as string,
                  name: x.name as string,
              }))
        : [];
    if (figmaScreensMeta.length === 0) {
        return res.status(400).json({ error: 'figmaScreensMeta debe ser un array no vacío.' });
    }
    figmaScreensMeta.sort((a, b) => a.screenIndex - b.screenIndex);
    const rawHifi = body.hifiWireframesHtml;
    const hifiWireframesHtml = Array.isArray(rawHifi)
        ? (rawHifi as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
        : [];
    const n = figmaScreensMeta.length;
    const hifiAligned =
        hifiWireframesHtml.length >= n
            ? hifiWireframesHtml.slice(0, n)
            : [...hifiWireframesHtml, ...Array.from({ length: n - hifiWireframesHtml.length }, () => '<!-- sin HTML -->')];

    const specMd = buildPlatformSpecMarkdown({
        initiativeName,
        jiraTicket: String(body.jiraTicket ?? '').trim(),
        squad: String(body.squad ?? '').trim(),
        analysis: body.analysis,
        solution,
    });
    const feedback = String(body.feedback ?? '').trim() || undefined;
    try {
        const snaps = await loadFigmaSnapshotsForTsx(figmaFileUrl, figmaScreensMeta);
        const tsxFinalScreens = await generateTsxFromFigma(
            specMd,
            hifiAligned,
            { figmaFileUrl, screensMeta: figmaScreensMeta, feedback },
            snaps ? { screenSnapshots: snaps } : undefined
        );
        res.json({ success: true, tsxFinalScreens });
    } catch (error) {
        console.error('Error en generate-tsx-from-figma:', error);
        const msg = (error as Error)?.message || 'Error generando TSX desde Figma';
        res.status(500).json({ error: msg });
    }
});

/** POST /api/generate-spec — Prompt C (spec para revisión tipo Gate 1, sin persistir tarjeta). */
router.post('/generate-spec', async (req, res) => {
    const { transcript } = req.body as { transcript?: string };

    if (!transcript?.trim()) {
        return res.status(400).json({ error: 'No se recibió la transcripción de la reunión.' });
    }

    try {
        const spec = await generateSpecWithPromptC(transcript.trim());
        res.json({
            success: true,
            spec,
        });
    } catch (error) {
        console.error('Error en Gemini (Prompt C):', error);
        res.status(500).json({ error: 'Hubo un problema al procesar la reunión con IA.' });
    }
});

/** POST /api/generate-handoff-zip — ZIP para desarrollo (README, theme, rutas, screens, API, SVG). */
router.post('/generate-handoff-zip', async (req, res) => {
    const body = req.body as {
        initiativeName?: string;
        analysis?: unknown;
        userFlowSvg?: string;
        hifiWireframesHtml?: unknown;
        tsxMuiScreens?: unknown;
        tsxFinalScreens?: unknown;
        tsxSource?: string;
        figmaFileUrl?: string;
        figmaScreensMeta?: unknown;
        flowStepLabels?: unknown;
    };
    const initiativeName = String(body.initiativeName ?? '').trim();
    if (!initiativeName) {
        return res.status(400).json({ error: 'initiativeName es obligatorio.' });
    }
    if (!isUnderstandingAnalysis(body.analysis)) {
        return res.status(400).json({ error: 'analysis inválido.' });
    }
    const analysis = body.analysis;
    const userFlowSvg = String(body.userFlowSvg ?? '').trim();
    const rawHifi = body.hifiWireframesHtml;
    const hifiWireframesHtml = Array.isArray(rawHifi)
        ? (rawHifi as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
    const rawFinal = body.tsxFinalScreens;
    const tsxFinalScreens = Array.isArray(rawFinal)
        ? (rawFinal as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
    const rawTsx = body.tsxMuiScreens;
    const tsxMuiScreens = Array.isArray(rawTsx)
        ? (rawTsx as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
    const tsxForZip = tsxFinalScreens.length > 0 ? tsxFinalScreens : tsxMuiScreens;
    if (tsxForZip.length === 0) {
        return res.status(400).json({
            error: 'Enviá tsxFinalScreens o tsxMuiScreens como array de strings no vacío.',
        });
    }
    const tsxSource: 'figma' | 'wireframes' =
        body.tsxSource === 'wireframes'
            ? 'wireframes'
            : tsxFinalScreens.length > 0
              ? 'figma'
              : 'wireframes';
    const figmaFileUrl = String(body.figmaFileUrl ?? '').trim() || undefined;
    const rawFigmaMeta = body.figmaScreensMeta;
    const figmaScreensMeta = Array.isArray(rawFigmaMeta)
        ? (rawFigmaMeta as unknown[])
              .filter((x) => x && typeof x === 'object')
              .map((x) => x as Record<string, unknown>)
              .filter(
                  (x) =>
                      typeof x.screenIndex === 'number' &&
                      typeof x.nodeId === 'string' &&
                      typeof x.name === 'string'
              )
              .map((x) => ({
                  screenIndex: x.screenIndex as number,
                  nodeId: x.nodeId as string,
                  name: x.name as string,
              }))
        : undefined;
    const rawSteps = body.flowStepLabels;
    const flowStepLabels = Array.isArray(rawSteps)
        ? (rawSteps as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];

    try {
        const analysisMarkdown = buildAnalysisMarkdownForHandoff(analysis);
        const zipBuffer = await generateHandoffZip({
            initiativeName,
            executiveSummary: analysis.executiveSummary,
            analysisMarkdown,
            userFlowSvg,
            hifiHtmlScreens: hifiWireframesHtml,
            tsxScreens: tsxForZip,
            flowStepLabels,
            availableEndpoints: analysis.availableEndpoints,
            tsxSource,
            figmaFileUrl,
            figmaScreensMeta,
        });
        const safe = initiativeName.replace(/[^\w\-.]+/g, '_').slice(0, 72) || 'handoff';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safe}-handoff.zip"`);
        res.send(zipBuffer);
    } catch (error) {
        console.error('Error en generate-handoff-zip:', error);
        const msg = (error as Error)?.message || 'Error generando ZIP de handoff';
        res.status(500).json({ error: msg });
    }
});

export default router;
