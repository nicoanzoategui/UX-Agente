import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import {
    consumeFigmaBuildJob,
    createFigmaBuildJob,
    purgeExpiredFigmaBuildJobs,
    type FigmaBuildJobScreen,
} from '../services/figma-build-job.service.js';

const router = Router();

function parseScreensBody(raw: unknown): FigmaBuildJobScreen[] | null {
    if (!Array.isArray(raw)) return null;
    const out: FigmaBuildJobScreen[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        if (typeof o.screenIndex !== 'number' || typeof o.name !== 'string') return null;
        out.push({ screenIndex: o.screenIndex, name: o.name });
    }
    return out.length ? out : null;
}

/**
 * Crea un job para que el plugin de Figma cree frames en el archivo abierto.
 * POST /api/figma-build-job
 */
router.post('/figma-build-job', requireAuth, async (req, res) => {
    const body = req.body as {
        destinationUrl?: string;
        screens?: unknown;
        layout?: unknown;
    };
    const destinationUrl = String(body.destinationUrl ?? '').trim();
    if (!destinationUrl) {
        return res.status(400).json({ error: 'destinationUrl es obligatorio.' });
    }
    const screens = parseScreensBody(body.screens);
    if (!screens) {
        return res.status(400).json({ error: 'screens debe ser un array de { screenIndex, name }.' });
    }
    let layout: { frameWidth?: number; frameHeight?: number; gap?: number; startX?: number; startY?: number } = {};
    if (body.layout && typeof body.layout === 'object') {
        const L = body.layout as Record<string, unknown>;
        const n = (k: string) => (typeof L[k] === 'number' ? (L[k] as number) : undefined);
        layout = {
            frameWidth: n('frameWidth'),
            frameHeight: n('frameHeight'),
            gap: n('gap'),
            startX: n('startX'),
            startY: n('startY'),
        };
    }
    try {
        void purgeExpiredFigmaBuildJobs();
        const { jobId, fetchSecret, expiresAt } = await createFigmaBuildJob({
            destinationUrl,
            screens,
            layout,
        });
        res.json({ success: true, jobId, fetchSecret, expiresAt });
    } catch (e) {
        const msg = (e as Error)?.message || 'No se pudo crear el job de Figma.';
        res.status(400).json({ error: msg });
    }
});

/**
 * El plugin de Figma consume el job una sola vez (se borra al leer).
 * GET /api/figma-build-job/:jobId?secret=...
 */
router.get('/figma-build-job/:jobId', async (req, res) => {
    const jobId = String(req.params.jobId ?? '').trim();
    const secret = String(req.query.secret ?? '').trim();
    if (!jobId || !secret) {
        return res.status(400).json({ error: 'jobId y secret son obligatorios.' });
    }
    const payload = await consumeFigmaBuildJob(jobId, secret);
    if (!payload) {
        return res.status(404).json({ error: 'Job inválido, expirado o ya consumido.' });
    }
    res.json({ success: true, payload });
});

export default router;
