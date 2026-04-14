import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Raíz del repo (backend/src/config → ../../..). Usado por AIDesigner CLI (--cwd / repo_context). */
const __configDir = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__configDir, '..', '..', '..');

// Monorepo: `.env` suele vivir en la raíz; `backend/.env` puede sobreescribir si existe.
dotenv.config({ path: join(REPO_ROOT, '.env') });
dotenv.config();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw.trim() === '') return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return fallback;
    return n;
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_MAX = 600;

export const config = {
    PORT: process.env.PORT || 3001,

    /** Tras un reverse proxy (nginx, etc.): `1` o `true` para que `req.ip` y el rate limit usen el cliente real */
    TRUST_PROXY: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',

    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    /**
     * Brief para la generación de wireframe alta fidelidad (equivalente en espíritu a `viewport` en MCP tipo AIDesigner).
     * Con HIFI_PROVIDER=gemini, el modelo es GEMINI_MODEL. Con aidesigner, lo aplica el CLI/API de AIDesigner.
     */
    HIFI_VIEWPORT: process.env.HIFI_VIEWPORT === 'mobile' ? ('mobile' as const) : ('desktop' as const),

    /**
     * `gemini` (default): alta fidelidad vía Gemini en llm.service.
     * `aidesigner`: alta fidelidad vía `npx @aidesigner/agent-skills generate` (mismo servicio que el MCP; requiere API key o token).
     */
    HIFI_PROVIDER:
        (process.env.HIFI_PROVIDER || 'gemini').toLowerCase().trim() === 'aidesigner' ? 'aidesigner' : 'gemini',

    /** API key para el CLI de AIDesigner (ver https://www.aidesigner.ai/docs/mcp — API Key Fallback). */
    AIDESIGNER_API_KEY: (process.env.AIDESIGNER_API_KEY || '').trim(),
    /** Alternativa avanzada a la API key (Bearer para MCP/CLI). */
    AIDESIGNER_MCP_ACCESS_TOKEN: (process.env.AIDESIGNER_MCP_ACCESS_TOKEN || '').trim(),
    AIDESIGNER_BASE_URL: (process.env.AIDESIGNER_BASE_URL || 'https://api.aidesigner.ai').trim(),
    /** Carpeta de artefactos; default `<repo>/.aidesigner`. */
    AIDESIGNER_OUT_DIR: (process.env.AIDESIGNER_OUT_DIR || '').trim(),
    /** Tiempo máximo de espera del proceso `generate` (ms). */
    HIFI_AIDESIGNER_TIMEOUT_MS: Math.min(
        600_000,
        Math.max(30_000, parsePositiveInt(process.env.HIFI_AIDESIGNER_TIMEOUT_MS, 180_000))
    ),

    /**
     * Token personal de Figma (Settings → Personal access tokens).
     * Permite leer el archivo destino, mapear frames a pantallas y exportar PNG para TSX desde Figma.
     * El MCP de Cursor no es invocable desde Express; este token es la integración servidor.
     */
    FIGMA_ACCESS_TOKEN: (process.env.FIGMA_ACCESS_TOKEN || '').trim(),

    /**
     * Orígenes extra para CORS (credenciales). El plugin de Figma hace fetch desde `https://www.figma.com`.
     * Lista separada por comas; por defecto se añade `https://www.figma.com` en `corsAllowedOrigins()`.
     */
    FIGMA_PLUGIN_CORS_ORIGINS: (process.env.FIGMA_PLUGIN_CORS_ORIGINS || '').trim(),

    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL!,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,

    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

    /** Ventana fija para rate limit `/api` (ms). Entre 1s y 24h. */
    RATE_LIMIT_WINDOW_MS: Math.min(
        24 * 60 * 60 * 1000,
        Math.max(1000, parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS))
    ),

    /** Máx. solicitudes por IP por ventana en `/api`. Entre 1 y 1e6. */
    RATE_LIMIT_MAX: Math.min(
        1_000_000,
        Math.max(1, parsePositiveInt(process.env.RATE_LIMIT_MAX, DEFAULT_RATE_MAX))
    ),

    NODE_ENV: process.env.NODE_ENV || 'development',

    /** Firma del JWT de sesión (obligatorio en producción). */
    JWT_SECRET: process.env.JWT_SECRET || '',

    /** Client ID OAuth de Google (Web) para verificar el ID token del front. */
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

    /** Lista separada por comas; si está vacía, cualquier cuenta Google puede entrar. */
    ALLOWED_EMAILS: (process.env.ALLOWED_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),

    /** Si se define (ej. `@empresa.com`), el email debe terminar así (tras normalizar). */
    ALLOWED_EMAIL_DOMAIN: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase(),

    /** Solo desarrollo: omite JWT/Google y usa sesión fija (nunca en producción). */
    AUTH_DISABLED: process.env.AUTH_DISABLED === '1' || process.env.AUTH_DISABLED === 'true',

    SESSION_COOKIE_NAME: 'fx_session',
    JWT_EXPIRES_DAYS: Math.min(30, Math.max(1, parsePositiveInt(process.env.JWT_EXPIRES_DAYS, 7))),
};

/**
 * Orígenes CORS (credenciales). `FRONTEND_URL` puede ser lista separada por comas.
 * En desarrollo se añade el espejo localhost ↔ 127.0.0.1 (mismo puerto) para evitar "Failed to fetch" al abrir la app por IP.
 */
export function corsAllowedOrigins(): string[] {
    const raw = (config.FRONTEND_URL || '').trim();
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const seeds = parts.length > 0 ? parts : ['http://localhost:5173'];
    const set = new Set<string>();
    for (const p of seeds) {
        set.add(p);
        if (config.NODE_ENV === 'production') continue;
        try {
            const u = new URL(p);
            const port = u.port ? `:${u.port}` : '';
            if (u.hostname === 'localhost') {
                set.add(`${u.protocol}//127.0.0.1${port}`);
            } else if (u.hostname === '127.0.0.1') {
                set.add(`${u.protocol}//localhost${port}`);
            }
        } catch {
            /* URL inválida: solo se usa el string tal cual */
        }
    }
    const figmaExtra = (config.FIGMA_PLUGIN_CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    for (const o of figmaExtra) set.add(o);
    set.add('https://www.figma.com');
    return Array.from(set);
}

/** Falla el arranque si la configuración de auth no es segura para producción. */
export function assertProductionAuthConfig(): void {
    if (config.NODE_ENV !== 'production') return;
    if (config.AUTH_DISABLED) {
        console.error('AUTH_DISABLED no está permitido en producción.');
        process.exit(1);
    }
    if (!config.JWT_SECRET || config.JWT_SECRET.length < 16) {
        console.error('En producción JWT_SECRET debe tener al menos 16 caracteres.');
        process.exit(1);
    }
    if (!config.GOOGLE_CLIENT_ID?.trim()) {
        console.error('En producción GOOGLE_CLIENT_ID es obligatorio.');
        process.exit(1);
    }
}

/** Avisos de arranque (sin bloquear): Turso es opcional en dev — SQLite local si no hay URL. */
if (!process.env.GEMINI_API_KEY?.trim()) {
    console.warn('GEMINI_API_KEY no definida: el agente UX (Gemini) no podrá generar contenido.');
}
const tursoUrl = (process.env.TURSO_DATABASE_URL || '').trim();
if (!tursoUrl) {
    console.log('DB: sin TURSO_DATABASE_URL → SQLite local en backend/local.db');
} else if (/^libsql:\/\//i.test(tursoUrl)) {
    if (!process.env.TURSO_AUTH_TOKEN?.trim()) {
        console.warn('TURSO_AUTH_TOKEN ausente: la base remota Turso probablemente falle.');
    }
}
