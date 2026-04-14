import { config } from '../config/env.js';

export type FigmaScreenMeta = {
    screenIndex: number;
    nodeId: string;
    name: string;
};

export type FigmaWireframeOrchestrationError = {
    screenIndex: number;
    message: string;
};

export type GenerateFigmaFromWireframesResult = {
    success: true;
    figmaFileUrl: string;
    figmaFileKey: string | null;
    screens: FigmaScreenMeta[];
    logs: string[];
    errors: FigmaWireframeOrchestrationError[];
    figmaApiUsed: boolean;
};

const FIGMA_FETCH_TIMEOUT_MS = 28_000;
const MAX_FRAMES_TO_SCAN = 400;

/** Convierte `node-id=3-5` → `3:5` (formato API Figma). */
export function figmaUrlNodeIdToApiId(nodeParam: string): string {
    const raw = decodeURIComponent(nodeParam.trim());
    if (!raw) return '';
    return raw.split('-').join(':');
}

export function parseFigmaDesignUrl(url: string): { fileKey: string; nodeId: string | null } | null {
    const u = url.trim();
    if (!u) return null;
    try {
        const parsed = new URL(u);
        if (!parsed.hostname.endsWith('figma.com')) return null;
        const m = parsed.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/);
        if (!m?.[1]) return null;
        const fileKey = m[1];
        const rawNode = parsed.searchParams.get('node-id');
        const nodeId = rawNode ? figmaUrlNodeIdToApiId(rawNode) : null;
        return { fileKey, nodeId };
    } catch {
        return null;
    }
}

export function buildFigmaDesignUrl(fileKey: string, nodeId?: string | null): string {
    const base = `https://www.figma.com/design/${fileKey}/`;
    if (nodeId?.trim()) {
        const urlNode = nodeId.trim().split(':').join('-');
        return `${base}?node-id=${encodeURIComponent(urlNode)}`;
    }
    return base;
}

type FigmaNode = {
    id?: string;
    name?: string;
    type?: string;
    children?: FigmaNode[];
};

function walkFrames(node: FigmaNode | undefined, out: { id: string; name: string }[], cap: number): void {
    if (!node || out.length >= cap) return;
    const type = node.type ?? '';
    const id = node.id ?? '';
    const name = (node.name ?? '').trim();
    if (id && (type === 'FRAME' || type === 'COMPONENT')) {
        out.push({ id, name: name || id });
    }
    const kids = node.children;
    if (!Array.isArray(kids)) return;
    for (const c of kids) {
        walkFrames(c, out, cap);
        if (out.length >= cap) return;
    }
}

async function fetchWithTimeout(url: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FIGMA_FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

export async function fetchFigmaFileDocument(fileKey: string, token: string): Promise<{ document: FigmaNode }> {
    const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}`;
    const res = await fetchWithTimeout(url, {
        headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Figma files API ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as { document?: FigmaNode };
    if (!json.document) throw new Error('Respuesta Figma sin document.');
    return { document: json.document };
}

/** Subárbol para un `node-id` concreto (página o frame). */
export async function fetchFigmaNodeSubtree(fileKey: string, nodeId: string, token: string): Promise<FigmaNode | null> {
    const url = new URL(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes`);
    url.searchParams.set('ids', nodeId);
    const res = await fetchWithTimeout(url.toString(), {
        headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Figma nodes API ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
        nodes?: Record<string, { document?: FigmaNode } | undefined>;
    };
    const entry = json.nodes?.[nodeId];
    return entry?.document ?? null;
}

/**
 * Devuelve URLs de render PNG por nodo (GET /v1/images).
 */
export async function fetchFigmaPngRenderUrls(
    fileKey: string,
    nodeIds: string[],
    token: string
): Promise<Record<string, string | null>> {
    const real = nodeIds.filter((id) => id && !id.startsWith('pending:'));
    if (real.length === 0) return {};
    const url = new URL(`https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}`);
    url.searchParams.set('ids', real.join(','));
    url.searchParams.set('format', 'png');
    url.searchParams.set('scale', '2');
    const res = await fetchWithTimeout(url.toString(), {
        headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Figma images API ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as { images?: Record<string, string | null> };
    return json.images ?? {};
}

export async function downloadUrlToBuffer(imageUrl: string): Promise<Buffer | null> {
    try {
        const res = await fetchWithTimeout(imageUrl, {});
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    } catch {
        return null;
    }
}

/**
 * Por pantalla: intenta asociar un frame del archivo Figma (orden DFS).
 * Sin token o sin API: devuelve `pending:N` y logs explicativos.
 */
export async function generateFigmaFromWireframes(input: {
    initiativeName: string;
    hifiWireframesHtml: string[];
    solutionFlowSteps: string[];
    designSystemUrl: string;
    destinationUrl: string;
}): Promise<GenerateFigmaFromWireframesResult> {
    const logs: string[] = [];
    const errors: FigmaWireframeOrchestrationError[] = [];
    const n = input.hifiWireframesHtml.length;

    logs.push(
        'Nota: el servidor Express no puede invocar el MCP de Figma de Cursor; se usa la API REST de Figma cuando hay FIGMA_ACCESS_TOKEN.'
    );
    logs.push(`Iniciativa: ${input.initiativeName}`);
    logs.push(`Pantallas (wireframes HiFi): ${n}`);

    const ds = parseFigmaDesignUrl(input.designSystemUrl);
    if (ds) {
        logs.push(`Design system parseado (fileKey=${ds.fileKey}).`);
    } else {
        logs.push('Design system URL no reconocida como link figma.com (se ignora para API).');
    }

    const dest = parseFigmaDesignUrl(input.destinationUrl);
    if (!dest) {
        logs.push('ERROR: destinationUrl no es un link válido de Figma (design o file).');
        const screens: FigmaScreenMeta[] = input.hifiWireframesHtml.map((_, i) => ({
            screenIndex: i + 1,
            nodeId: `pending:${i + 1}`,
            name: input.solutionFlowSteps[i]?.trim() || `Pantalla ${i + 1}`,
        }));
        for (let i = 0; i < n; i++) {
            errors.push({ screenIndex: i + 1, message: 'URL de destino Figma inválida.' });
        }
        return {
            success: true,
            figmaFileUrl: input.destinationUrl,
            figmaFileKey: null,
            screens,
            logs,
            errors,
            figmaApiUsed: false,
        };
    }

    const figmaFileUrl = buildFigmaDesignUrl(dest.fileKey, dest.nodeId);
    const token = config.FIGMA_ACCESS_TOKEN?.trim();

    if (!token) {
        logs.push('FIGMA_ACCESS_TOKEN ausente: no se consulta el archivo; nodeId quedan en modo pending:*.');
        logs.push('Obtené un token en Figma → Settings → Personal access tokens y agregalo a backend/.env.');
        const screens: FigmaScreenMeta[] = input.hifiWireframesHtml.map((_, i) => ({
            screenIndex: i + 1,
            nodeId: `pending:${i + 1}`,
            name: input.solutionFlowSteps[i]?.trim() || `Pantalla ${i + 1}`,
        }));
        return {
            success: true,
            figmaFileUrl,
            figmaFileKey: dest.fileKey,
            screens,
            logs,
            errors,
            figmaApiUsed: false,
        };
    }

    let frames: { id: string; name: string }[] = [];
    try {
        if (dest.nodeId) {
            const subtree = await fetchFigmaNodeSubtree(dest.fileKey, dest.nodeId, token);
            if (subtree) {
                walkFrames(subtree, frames, MAX_FRAMES_TO_SCAN);
                logs.push(
                    `Subárbol node-id=${dest.nodeId}: candidatos FRAME/COMPONENT bajo ese nodo: ${frames.length}.`
                );
            } else {
                const { document } = await fetchFigmaFileDocument(dest.fileKey, token);
                walkFrames(document, frames, MAX_FRAMES_TO_SCAN);
                logs.push(
                    `node-id=${dest.nodeId} no devolvió subárbol; se usa documento completo. FRAME/COMPONENT: ${frames.length}.`
                );
                const anchorIdx = frames.findIndex((f) => f.id === dest.nodeId);
                if (anchorIdx >= 0) {
                    frames = frames.slice(anchorIdx);
                    logs.push(`Anclaje por id en lista plana: recorte desde índice ${anchorIdx}.`);
                }
            }
        } else {
            const { document } = await fetchFigmaFileDocument(dest.fileKey, token);
            walkFrames(document, frames, MAX_FRAMES_TO_SCAN);
            logs.push(`Archivo destino leído; candidatos FRAME/COMPONENT: ${frames.length}.`);
        }
    } catch (e) {
        const msg = (e as Error)?.message || String(e);
        logs.push(`Fallo al leer archivo Figma: ${msg}`);
        for (let i = 0; i < n; i++) {
            errors.push({ screenIndex: i + 1, message: msg });
        }
        const screens: FigmaScreenMeta[] = input.hifiWireframesHtml.map((_, i) => ({
            screenIndex: i + 1,
            nodeId: `pending:${i + 1}`,
            name: input.solutionFlowSteps[i]?.trim() || `Pantalla ${i + 1}`,
        }));
        return {
            success: true,
            figmaFileUrl,
            figmaFileKey: dest.fileKey,
            screens,
            logs,
            errors,
            figmaApiUsed: true,
        };
    }

    const screens: FigmaScreenMeta[] = [];
    for (let i = 0; i < n; i++) {
        const stepName = input.solutionFlowSteps[i]?.trim() || `Pantalla ${i + 1}`;
        const frame = frames[i];
        if (!frame) {
            errors.push({
                screenIndex: i + 1,
                message: 'No hay suficientes frames COMPONENT/FRAME en el archivo para mapear esta pantalla.',
            });
            screens.push({ screenIndex: i + 1, nodeId: `pending:${i + 1}`, name: stepName });
            logs.push(`Pantalla ${i + 1}: sin frame disponible → pending:${i + 1}.`);
            continue;
        }
        screens.push({ screenIndex: i + 1, nodeId: frame.id, name: frame.name || stepName });
        logs.push(`Pantalla ${i + 1}: asignada a nodo ${frame.id} (${frame.name}).`);
    }

    return {
        success: true,
        figmaFileUrl,
        figmaFileKey: dest.fileKey,
        screens,
        logs,
        errors,
        figmaApiUsed: true,
    };
}

/** Descarga PNG por nodo (omite pending:*). */
export async function fetchFigmaScreenPngs(fileKey: string, screens: FigmaScreenMeta[], token: string): Promise<(Buffer | null)[]> {
    const ids = screens.map((s) => s.nodeId);
    const urls = await fetchFigmaPngRenderUrls(fileKey, ids, token);
    const out: (Buffer | null)[] = [];
    for (const s of screens) {
        if (s.nodeId.startsWith('pending:')) {
            out.push(null);
            continue;
        }
        const u = urls[s.nodeId];
        if (!u) {
            out.push(null);
            continue;
        }
        out.push(await downloadUrlToBuffer(u));
    }
    return out;
}
