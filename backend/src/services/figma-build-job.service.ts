import { randomBytes } from 'node:crypto';
import { db } from '../db/database.js';
import { parseFigmaDesignUrl } from './figma.service.js';

export type FigmaBuildJobScreen = {
    screenIndex: number;
    name: string;
    /** HTML HiFi del paso wireframes (opcional). */
    hifiHtml?: string;
};

export type FigmaBuildJobPayload = {
    /** 1 = frames vacíos; 2 incluye designSystemFileKey y hifiHtml por pantalla para render vía plugin. */
    version: 1 | 2;
    destinationFileKey: string;
    /** Nodo destino (página/sección/frame) en formato API `1:2`; null = usar página actual del plugin. */
    destinationNodeId: string | null;
    /** File key del archivo del design system (componentes publicados). */
    designSystemFileKey: string | null;
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
    designSystemUrl?: string;
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

    const hasHifi = input.screens.some((s) => Boolean(s.hifiHtml?.trim()));
    let designSystemFileKey: string | null = null;
    if (input.designSystemUrl?.trim()) {
        const ds = parseFigmaDesignUrl(input.designSystemUrl.trim());
        if (ds) designSystemFileKey = ds.fileKey;
    }
    if (hasHifi && !designSystemFileKey) {
        throw new Error('Con wireframes HiFi en el job hace falta designSystemUrl (link Figma del design system).');
    }

    const layout: FigmaBuildJobPayload['layout'] = {
        frameWidth: input.layout?.frameWidth ?? 1280,
        frameHeight: input.layout?.frameHeight ?? 800,
        gap: input.layout?.gap ?? 80,
        startX: input.layout?.startX ?? 0,
        startY: input.layout?.startY ?? 0,
    };

    const version: 1 | 2 = hasHifi && designSystemFileKey ? 2 : 1;

    const payload: FigmaBuildJobPayload = {
        version,
        destinationFileKey: parsed.fileKey,
        destinationNodeId: parsed.nodeId,
        designSystemFileKey,
        screens: input.screens.map((s) => ({
            screenIndex: s.screenIndex,
            name: s.name.trim() || `Pantalla ${s.screenIndex}`,
            ...(s.hifiHtml?.trim() ? { hifiHtml: s.hifiHtml.trim() } : {}),
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
        const raw = JSON.parse(String(first.payload_json)) as Record<string, unknown>;
        const screensRaw = Array.isArray(raw.screens) ? raw.screens : [];
        const screens: FigmaBuildJobScreen[] = screensRaw.map((item, idx) => {
            const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            const screenIndex = typeof o.screenIndex === 'number' ? o.screenIndex : idx + 1;
            const name = typeof o.name === 'string' ? o.name : `Pantalla ${idx + 1}`;
            const hifiHtml = typeof o.hifiHtml === 'string' ? o.hifiHtml : undefined;
            return { screenIndex, name, ...(hifiHtml !== undefined ? { hifiHtml } : {}) };
        });
        const layoutRaw = raw.layout && typeof raw.layout === 'object' ? (raw.layout as Record<string, unknown>) : {};
        const L = (k: string, d: number) => (typeof layoutRaw[k] === 'number' ? (layoutRaw[k] as number) : d);
        const destNode = raw.destinationNodeId;
        const destNodeStr =
            destNode === null || destNode === undefined || destNode === '' ? null : String(destNode);
        const dsKeyRaw = raw.designSystemFileKey;
        const dsKey =
            dsKeyRaw === null || dsKeyRaw === undefined || String(dsKeyRaw).trim() === '' ? null : String(dsKeyRaw).trim();

        payload = {
            version: raw.version === 2 ? 2 : 1,
            destinationFileKey: String(raw.destinationFileKey ?? ''),
            destinationNodeId: destNodeStr,
            designSystemFileKey: dsKey,
            screens,
            layout: {
                frameWidth: L('frameWidth', 1280),
                frameHeight: L('frameHeight', 800),
                gap: L('gap', 80),
                startX: L('startX', 0),
                startY: L('startY', 0),
            },
        };
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
