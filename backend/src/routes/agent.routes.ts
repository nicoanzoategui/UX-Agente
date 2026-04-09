import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/require-auth.js';
import { understandingUploadFields } from '../middleware/understanding-upload.js';
import {
    generateIdeationSolutions,
    generateSolutionIterationReply,
    generateSpecWithPromptC,
    generateStepEWireframeOptions,
    generateUnderstandingAnalysis,
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
        solutionTitle?: string;
        initiativeName?: string;
        analysis?: unknown;
        history?: unknown;
        userMessage?: string;
    };
    const solutionTitle = String(body.solutionTitle ?? '').trim();
    const initiativeName = String(body.initiativeName ?? '').trim();
    const userMessage = String(body.userMessage ?? '').trim();
    if (!solutionTitle || !initiativeName || !userMessage) {
        return res.status(400).json({ error: 'solutionTitle, initiativeName y userMessage son obligatorios.' });
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
        const reply = await generateSolutionIterationReply({
            solutionTitle,
            initiativeName,
            analysis: body.analysis,
            history,
            userMessage,
        });
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Error en iterate-solution:', error);
        const msg = (error as Error)?.message || 'Error en la iteración';
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
