import { randomBytes } from 'node:crypto';
import { db } from '../db/database.js';
import { parseFigmaDesignUrl } from './figma.service.js';

export type FigmaBuildJobScreen = {
    screenIndex: number;
    name: string;
};

export type FigmaBuildJobPayload = {
    version: 1;
    destinationFileKey: string;
    /** Nodo destino (página/sección/frame) en formato API `1:2`; null = usar página actual del plugin. */
    destinationNodeId: string | null;
    screens: FigmaBuildJobScreen[];
    layout: {
        frameWidth: number;
        frameHeight: number;
        gap: number;
        startX: number;
        startY: number;
    };
};

const JOB_TTL_MS = 2 * 60 * 60 * 1000;

function nowIso(): string {
    return new Date().toISOString();
}

export async function createFigmaBuildJob(input: {
    destinationUrl: string;
    screens: FigmaBuildJobScreen[];
    layout?: Partial<FigmaBuildJobPayload['layout']>;
}): Promise<{ jobId: string; fetchSecret: string; expiresAt: string }> {
    const parsed = parseFigmaDesignUrl(input.destinationUrl);
    if (!parsed) {
        throw new Error('destinationUrl no es un link válido de Figma.');
    }
    if (!input.screens.length) {
        throw new Error('Se requiere al menos una pantalla.');
    }

    const layout: FigmaBuildJobPayload['layout'] = {
        frameWidth: input.layout?.frameWidth ?? 1280,
        frameHeight: input.layout?.frameHeight ?? 800,
        gap: input.layout?.gap ?? 80,
        startX: input.layout?.startX ?? 0,
        startY: input.layout?.startY ?? 0,
    };

    const payload: FigmaBuildJobPayload = {
        version: 1,
        destinationFileKey: parsed.fileKey,
        destinationNodeId: parsed.nodeId,
        screens: input.screens.map((s) => ({
            screenIndex: s.screenIndex,
            name: s.name.trim() || `Pantalla ${s.screenIndex}`,
        })),
        layout,
    };

    const jobId = randomBytes(16).toString('hex');
    const fetchSecret = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + JOB_TTL_MS).toISOString();

    await db.execute({
        sql: `INSERT INTO figma_build_jobs (id, fetch_secret, payload_json, created_at, expires_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [jobId, fetchSecret, JSON.stringify(payload), nowIso(), expiresAt],
    });

    return { jobId, fetchSecret, expiresAt };
}

export async function consumeFigmaBuildJob(jobId: string, secret: string): Promise<FigmaBuildJobPayload | null> {
    const row = await db.execute({
        sql: `SELECT id, fetch_secret, payload_json, expires_at FROM figma_build_jobs WHERE id = ?`,
        args: [jobId],
    });
    const first = row.rows[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    if (String(first.fetch_secret) !== secret) return null;
    const exp = Date.parse(String(first.expires_at));
    if (!Number.isFinite(exp) || Date.now() > exp) {
        await db.execute({ sql: `DELETE FROM figma_build_jobs WHERE id = ?`, args: [jobId] });
        return null;
    }
    let payload: FigmaBuildJobPayload;
    try {
        payload = JSON.parse(String(first.payload_json)) as FigmaBuildJobPayload;
    } catch {
        await db.execute({ sql: `DELETE FROM figma_build_jobs WHERE id = ?`, args: [jobId] });
        return null;
    }
    await db.execute({ sql: `DELETE FROM figma_build_jobs WHERE id = ?`, args: [jobId] });
    return payload;
}

/** Limpieza best-effort de jobs vencidos (no bloquea). */
export async function purgeExpiredFigmaBuildJobs(): Promise<void> {
    try {
        await db.execute({
            sql: `DELETE FROM figma_build_jobs WHERE datetime(expires_at) < datetime('now')`,
            args: [],
        });
    } catch {
        /* ignore */
    }
}
