import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');

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
/** Relleno RGBA 0–1 para rectángulos. */
export type FigmaRenderFill = { r: number; g: number; b: number; a?: number };

/** Instrucciones de nodos para el plugin Figma (árbol). */
export type FigmaRenderNode =
    | {
          type: 'TEXT';
          x: number;
          y: number;
          width?: number;
          height?: number;
          text: string;
          fontSize?: number;
          name?: string;
      }
    | {
          type: 'RECTANGLE';
          x: number;
          y: number;
          width: number;
          height: number;
          fills?: FigmaRenderFill;
          cornerRadius?: number;
          name?: string;
      }
    | {
          type: 'FRAME';
          x: number;
          y: number;
          width: number;
          height: number;
          name?: string;
          layoutMode?: 'NONE' | 'VERTICAL' | 'HORIZONTAL';
          itemSpacing?: number;
          paddingLeft?: number;
          paddingRight?: number;
          paddingTop?: number;
          paddingBottom?: number;
          children?: FigmaRenderNode[];
      }
    | {
          type: 'INSTANCE';
          componentKey: string;
          x: number;
          y: number;
          width?: number;
          height?: number;
          name?: string;
      };

export type GenerateFigmaNodesFromHtmlResult = {
    nodes: FigmaRenderNode[];
    warnings: string[];
};

type FigmaComponentsApiMeta = {
    components?: { key?: string; name?: string; description?: string }[];
};

const MAX_HIFI_HTML_CHARS = 100_000;
const MAX_COMPONENTS_IN_PROMPT = 220;
/** Líneas TSV prioritarias al inicio del prompt (nombres UI primero). */
const MAX_COMPONENTS_TSV_LINES = 100;

function scoreDsNameRelevance(name: string, desc: string): number {
    const blob = `${name} ${desc}`.toLowerCase();
    const hot = [
        'button',
        'btn',
        'input',
        'field',
        'textfield',
        'textarea',
        'select',
        'checkbox',
        'radio',
        'toggle',
        'switch',
        'card',
        'modal',
        'dialog',
        'label',
        'form',
        'badge',
        'chip',
        'tab',
        'avatar',
        'dropdown',
        'menu',
        'search',
        'icon',
        'link',
        'alert',
        'toast',
        'banner',
        'header',
        'footer',
        'primary',
        'secondary',
        'submit',
    ];
    let s = 0;
    for (const h of hot) {
        if (blob.includes(h)) s += 3;
    }
    return s;
}

function countFigmaRenderInstances(nodes: FigmaRenderNode[]): number {
    let n = 0;
    const walk = (node: FigmaRenderNode): void => {
        if (node.type === 'INSTANCE') n++;
        if (node.type === 'FRAME' && node.children) {
            for (const ch of node.children) walk(ch);
        }
    };
    for (const root of nodes) walk(root);
    return n;
}

/** El aviso de catálogo vía GET /files se emite una vez por design system (evita 8 líneas iguales en un job). */
const designSystemCatalogSourceNotified = new Set<string>();

type DesignSystemComponentRow = { key: string; name: string; description: string };

/** Misma lista de componentes para todas las pantallas de un job: evita 8× GET /v1/files (muy pesado). */
const designSystemComponentsCache = new Map<string, { list: DesignSystemComponentRow[]; until: number }>();
const DESIGN_SYSTEM_COMPONENTS_CACHE_MS = 15 * 60 * 1000;

async function loadDesignSystemComponentsForRender(
    fileKey: string,
    token: string,
    warnings: string[]
): Promise<DesignSystemComponentRow[]> {
    const now = Date.now();
    const hit = designSystemComponentsCache.get(fileKey);
    if (hit && hit.until > now && hit.list.length > 0) {
        return hit.list;
    }

    let components: DesignSystemComponentRow[] = [];
    try {
        components = await fetchFigmaFileComponentsList(fileKey, token);
    } catch (e) {
        warnings.push(`Figma GET …/components: ${(e as Error)?.message || String(e)}`);
    }
    if (!components.length) {
        try {
            const fromFile = await fetchFigmaFileComponentsFromFileMap(fileKey, token);
            if (fromFile.length) {
                components = fromFile;
                if (!designSystemCatalogSourceNotified.has(fileKey)) {
                    designSystemCatalogSourceNotified.add(fileKey);
                    warnings.push(
                        'Catálogo de componentes obtenido desde GET /v1/files (mapa `components`); el endpoint /components estaba vacío o falló.'
                    );
                }
            }
        } catch (e) {
            warnings.push(`Figma GET archivo (componentes en mapa): ${(e as Error)?.message || String(e)}`);
        }
    }
    if (!components.length) {
        warnings.push(
            'No se obtuvieron componentes del design system (publicá componentes al team library o verificá FIGMA_ACCESS_TOKEN con lectura del archivo).'
        );
    }
    if (components.length > 0) {
        designSystemComponentsCache.set(fileKey, { list: components, until: now + DESIGN_SYSTEM_COMPONENTS_CACHE_MS });
    }
    return components;
}

/**
 * Lista componentes publicados del archivo del design system (REST).
 * @see https://www.figma.com/developers/api#get-file-components-endpoint
 */
export async function fetchFigmaFileComponentsList(
    fileKey: string,
    token: string
): Promise<{ key: string; name: string; description: string }[]> {
    const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/components`;
    const res = await fetchWithTimeout(url, {
        headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Figma components API ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as { meta?: FigmaComponentsApiMeta };
    const raw = json.meta?.components;
    if (!Array.isArray(raw)) return [];
    const out: { key: string; name: string; description: string }[] = [];
    for (const c of raw) {
        const key = typeof c.key === 'string' ? c.key.trim() : '';
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        if (!key || !name) continue;
        out.push({
            key,
            name,
            description: typeof c.description === 'string' ? c.description.trim() : '',
        });
    }
    return out;
}

/**
 * Fallback cuando GET …/components devuelve lista vacía: el JSON del archivo incluye `components` { nodeId → metadata }.
 * @see https://www.figma.com/developers/api#get-files-endpoint
 */
export async function fetchFigmaFileComponentsFromFileMap(
    fileKey: string,
    token: string
): Promise<{ key: string; name: string; description: string }[]> {
    const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}`;
    const res = await fetchWithTimeout(url, {
        headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Figma files API ${res.status}: ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
        components?: Record<string, { key?: string; name?: string; description?: string } | undefined>;
    };
    const map = json.components;
    if (!map || typeof map !== 'object') return [];
    const out: { key: string; name: string; description: string }[] = [];
    const seen = new Set<string>();
    for (const c of Object.values(map)) {
        if (!c || typeof c !== 'object') continue;
        const key = typeof c.key === 'string' ? c.key.trim() : '';
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        if (!key || !name || seen.has(key)) continue;
        seen.add(key);
        out.push({
            key,
            name,
            description: typeof c.description === 'string' ? c.description.trim() : '',
        });
    }
    return out;
}

function extractJsonObject(text: string): unknown {
    const t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence?.[1]?.trim() ?? t;
    return JSON.parse(body) as unknown;
}

/** Números que Gemini a veces manda como string ("12", "0"). */
function coerceNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v.trim());
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

/** Si `type` viene vacío o ausente, inferir desde campos típicos de Gemini. */
function inferFigmaRenderNodeType(o: Record<string, unknown>): string {
    const raw = typeof o.type === 'string' ? o.type.trim().toUpperCase() : '';
    if (raw) return raw;
    const ck = typeof o.componentKey === 'string' ? o.componentKey.trim() : '';
    if (ck) return 'INSTANCE';
    if (
        (typeof o.text === 'string' && o.text.trim()) ||
        (typeof o.characters === 'string' && o.characters.trim()) ||
        (typeof o.content === 'string' && o.content.trim())
    ) {
        return 'TEXT';
    }
    if ('children' in o && Array.isArray(o.children)) return 'FRAME';
    const w = coerceNumber(o.width);
    const h = coerceNumber(o.height);
    const x = coerceNumber(o.x);
    const y = coerceNumber(o.y);
    if (w !== undefined && h !== undefined && x !== undefined && y !== undefined) return 'RECTANGLE';
    return '';
}

/**
 * Parsea JSON del modelo: quita fences, trailing commas típicas, y subcadena { … }.
 */
function tryParseModelJson(text: string): unknown | null {
    const t = text.trim();
    const candidates: string[] = [t];
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]?.trim()) candidates.push(fence[1].trim());
    const tryParse = (raw: string): unknown | null => {
        let cur = raw;
        for (let pass = 0; pass < 6; pass++) {
            try {
                return JSON.parse(cur) as unknown;
            } catch {
                const next = cur.replace(/,\s*([\]}])/g, '$1');
                if (next === cur) break;
                cur = next;
            }
        }
        return null;
    };
    for (const c of candidates) {
        const ok = tryParse(c);
        if (ok !== null) return ok;
    }
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
        const sliced = t.slice(start, end + 1);
        return tryParse(sliced);
    }
    return null;
}

function normalizeFigmaRenderNode(raw: unknown, path: string, warnings: string[]): FigmaRenderNode | null {
    if (!raw || typeof raw !== 'object') {
        warnings.push(`${path}: nodo inválido (no objeto).`);
        return null;
    }
    const o = raw as Record<string, unknown>;
    const type = inferFigmaRenderNodeType(o);
    const name = typeof o.name === 'string' ? o.name : undefined;

    if (!type) {
        warnings.push(`${path}: tipo desconocido o vacío (sin campos para inferir).`);
        return null;
    }

    if (type === 'TEXT') {
        const textRaw =
            typeof o.text === 'string'
                ? o.text
                : typeof o.characters === 'string'
                  ? o.characters
                  : typeof o.content === 'string'
                    ? o.content
                    : '';
        const textVal = textRaw.length ? textRaw.slice(0, 4000) : '';
        if (!textVal.trim()) {
            warnings.push(`${path}: TEXT sin texto (usá "text").`);
            return null;
        }
        const x = coerceNumber(o.x) ?? 0;
        const y = coerceNumber(o.y) ?? 0;
        return {
            type: 'TEXT',
            x,
            y,
            width: coerceNumber(o.width),
            height: coerceNumber(o.height),
            text: textVal,
            fontSize: coerceNumber(o.fontSize),
            name,
        };
    }
    if (type === 'RECTANGLE') {
        const x = coerceNumber(o.x);
        const y = coerceNumber(o.y);
        const width = coerceNumber(o.width);
        const height = coerceNumber(o.height);
        if (x === undefined || y === undefined || width === undefined || height === undefined) {
            warnings.push(`${path}: RECTANGLE requiere x,y,width,height.`);
            return null;
        }
        let fills: FigmaRenderFill | undefined;
        if (o.fills && typeof o.fills === 'object') {
            const f = o.fills as Record<string, unknown>;
            const r = coerceNumber(f.r);
            const g = coerceNumber(f.g);
            const b = coerceNumber(f.b);
            if (r !== undefined && g !== undefined && b !== undefined) {
                fills = { r, g, b, a: coerceNumber(f.a) };
            }
        }
        return {
            type: 'RECTANGLE',
            x,
            y,
            width,
            height,
            fills,
            cornerRadius: coerceNumber(o.cornerRadius),
            name,
        };
    }
    if (type === 'INSTANCE') {
        const ck = typeof o.componentKey === 'string' ? o.componentKey.trim() : '';
        const x = coerceNumber(o.x);
        const y = coerceNumber(o.y);
        if (!ck || x === undefined || y === undefined) {
            warnings.push(`${path}: INSTANCE requiere componentKey,x,y.`);
            return null;
        }
        return {
            type: 'INSTANCE',
            componentKey: ck,
            x,
            y,
            width: coerceNumber(o.width),
            height: coerceNumber(o.height),
            name,
        };
    }
    if (type === 'FRAME') {
        const x = coerceNumber(o.x);
        const y = coerceNumber(o.y);
        const width = coerceNumber(o.width);
        const height = coerceNumber(o.height);
        if (x === undefined || y === undefined || width === undefined || height === undefined) {
            warnings.push(`${path}: FRAME requiere x,y,width,height.`);
            return null;
        }
        const childrenRaw = Array.isArray(o.children) ? o.children : [];
        const children: FigmaRenderNode[] = [];
        let i = 0;
        for (const c of childrenRaw) {
            const n = normalizeFigmaRenderNode(c, `${path}.children[${i}]`, warnings);
            if (n) children.push(n);
            i++;
        }
        const lm = typeof o.layoutMode === 'string' ? o.layoutMode.toUpperCase() : 'NONE';
        const layoutMode = lm === 'VERTICAL' || lm === 'HORIZONTAL' ? lm : 'NONE';
        return {
            type: 'FRAME',
            x,
            y,
            width,
            height,
            name,
            layoutMode,
            itemSpacing: coerceNumber(o.itemSpacing),
            paddingLeft: coerceNumber(o.paddingLeft),
            paddingRight: coerceNumber(o.paddingRight),
            paddingTop: coerceNumber(o.paddingTop),
            paddingBottom: coerceNumber(o.paddingBottom),
            children: children.length ? children : undefined,
        };
    }
    warnings.push(`${path}: tipo desconocido "${type}".`);
    return null;
}

function normalizeFigmaRenderNodes(parsed: unknown, warnings: string[]): FigmaRenderNode[] {
    if (!parsed || typeof parsed !== 'object') return [];
    const o = parsed as Record<string, unknown>;
    const arr = Array.isArray(o.nodes) ? o.nodes : Array.isArray(parsed) ? (parsed as unknown[]) : [];
    if (!Array.isArray(arr)) return [];
    const out: FigmaRenderNode[] = [];
    let i = 0;
    for (const item of arr) {
        const n = normalizeFigmaRenderNode(item, `nodes[${i}]`, warnings);
        if (n) out.push(n);
        i++;
    }
    return out;
}

/**
 * Usa Gemini + catálogo REST de componentes del design system para producir un árbol de nodos Figma
 * alineado al wireframe HTML (layout aproximado; INSTANCE solo con `componentKey` del listado).
 */
export async function generateFigmaNodesFromHtml(input: {
    hifiHtml: string;
    designSystemFileKey: string;
    destinationFileKey: string;
    token: string;
}): Promise<GenerateFigmaNodesFromHtmlResult> {
    const warnings: string[] = [];
    if (!config.GEMINI_API_KEY?.trim()) {
        throw new Error('GEMINI_API_KEY no configurada.');
    }
    const token = input.token.trim();
    if (!token) throw new Error('FIGMA_ACCESS_TOKEN ausente en el servidor.');

    const html = input.hifiHtml.trim().slice(0, MAX_HIFI_HTML_CHARS);
    if (!html) {
        return { nodes: [], warnings: ['HTML vacío.'] };
    }

    const components = await loadDesignSystemComponentsForRender(input.designSystemFileKey, token, warnings);

    const sortedForPrompt = [...components].sort((a, b) => {
        const sb = scoreDsNameRelevance(b.name, b.description);
        const sa = scoreDsNameRelevance(a.name, a.description);
        if (sb !== sa) return sb - sa;
        return a.name.localeCompare(b.name);
    });
    const capped = sortedForPrompt.slice(0, MAX_COMPONENTS_IN_PROMPT);
    const catalog = capped.map((c) => ({
        key: c.key,
        name: c.name,
        desc: c.description.slice(0, 200),
    }));

    const tsvLines = capped
        .slice(0, MAX_COMPONENTS_TSV_LINES)
        .map((c) => {
            const desc = c.description.replace(/\s+/g, ' ').trim().slice(0, 120);
            const safeName = c.name.replace(/\t/g, ' ').replace(/\n/g, ' ');
            return `${c.key}\t${safeName}\t${desc}`;
        })
        .join('\n');

    const system = `Sos experto en design systems en Figma. Traducís wireframe HTML (clases Tailwind-ish) a un árbol JSON que un plugin va a instanciar DENTRO de un frame ya creado.

PRIORIDAD ABSOLUTA — REUTILIZAR EL DESIGN SYSTEM:
- Por cada pieza de UI (botón de pago, campo de tarjeta, label, card contenedora, icono con wrapper, etc.) buscá en el catálogo (TSV + JSON) el componente cuyo nombre o descripción mejor coincida y usá type "INSTANCE" con "componentKey" EXACTAMENTE igual al valor de la primera columna del TSV o al campo "key" del JSON. No inventes keys.
- Construí la jerarquía con FRAMEs que agrupen INSTANCEs (layout vertical/horizontal cuando aplique).
- TEXT: solo para títulos o copy suelta que no tenga un componente de texto/label en el catálogo; siempre con "text", "x", "y" numéricos.
- RECTANGLE: solo rellenos o separadores cuando no exista componente equivalente en el catálogo.

FORMATO DE SALIDA:
- SOLO JSON válido: { "nodes": [ ... ] } sin markdown ni comas finales.
- Tipos: FRAME, TEXT, RECTANGLE, INSTANCE. Siempre incluí "type" en cada nodo.
- x,y,width,height en px como números JSON (no strings).
- Máximo ~40 nodos y ~6 niveles de profundidad.
- destinationFileKey (referencia): ${input.destinationFileKey}`;

    const user = `## Catálogo del design system — leé primero el TSV
Cada fila es: componentKey TAB nombre TAB descripción corta.
Para INSTANCE usá ese componentKey literal (primera columna). El JSON debajo repite las mismas entradas.

TSV:
${tsvLines || '(sin componentes en catálogo)'}

## Catálogo JSON
${JSON.stringify(catalog)}

## Wireframe HTML
${html}`;

    const model = genAI.getGenerativeModel({
        model: config.GEMINI_MODEL || 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
        },
    });

    const combined = `${system}\n\n---\n\n${user}`;
    const runGenerate = async (): Promise<string> => {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: combined }] }],
        });
        const fb = result.response.promptFeedback;
        if (fb?.blockReason) {
            throw new Error(`Gemini bloqueó el prompt: ${fb.blockReason}`);
        }
        return result.response.text();
    };

    let text = await runGenerate();
    let parsed = tryParseModelJson(text);
    if (parsed === null) {
        const fixModel = genAI.getGenerativeModel({
            model: config.GEMINI_MODEL || 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.05,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
        });
        const fixPrompt = `El siguiente texto debería ser un único objeto JSON con forma {"nodes":[...]} pero está mal formado o truncado.
Devolvé SOLO JSON válido minificado, sin markdown ni texto alrededor. Corregí comas finales, comillas y llaves.

---
${text.slice(0, 14_000)}`;
        const fixRes = await fixModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: fixPrompt }] }],
        });
        const fb2 = fixRes.response.promptFeedback;
        if (fb2?.blockReason) {
            throw new Error(`Gemini (reintento JSON) bloqueó: ${fb2.blockReason}`);
        }
        text = fixRes.response.text();
        parsed = tryParseModelJson(text);
    }
    if (parsed === null) {
        try {
            parsed = extractJsonObject(text);
        } catch (e) {
            const hint = (e as Error)?.message || String(e);
            throw new Error(`Gemini no devolvió JSON parseable: ${hint}`);
        }
    }
    const nodes = normalizeFigmaRenderNodes(parsed, warnings);
    if (!nodes.length) {
        warnings.push('El modelo no produjo nodos válidos; revisá el HTML o el catálogo de componentes.');
    } else if (components.length > 0 && countFigmaRenderInstances(nodes) === 0) {
        warnings.push(
            'El resultado no usa ningún INSTANCE del design system (solo primitivas). Los componentes deben estar publicados en la librería del equipo para que el plugin pueda importarlos por key; revisá también que los nombres del catálogo coincidan con el HTML.'
        );
    }
    return { nodes, warnings };
}

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
