import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/require-auth.js';
import { understandingUploadFields } from '../middleware/understanding-upload.js';
import {
    generateIdeationSolutions,
    generatePrototypeFlowScreens,
    generatePrototypeIterationReply,
    generateSolutionIterationReply,
    generateSpecWithPromptC,
    generateStepEWireframeOptions,
    generateUnderstandingAnalysis,
    type IdeationSolutionDto,
    type PrototypeScreenSpecDto,
    type UnderstandingAnalysisResult,
} from '../services/llm.service.js';

const router = Router();

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

export default router;
