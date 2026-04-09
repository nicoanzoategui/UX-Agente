import { config } from './env.js';

export type SessionCookieSetOptions = {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax' | 'none' | 'strict';
    maxAge: number;
    path: '/';
    domain?: string;
};

/**
 * Opciones de la cookie de sesión (`fx_session`).
 * En producción por defecto: SameSite=None + Secure para que el navegador la envíe
 * en peticiones cross-origin (p. ej. front en Vercel, API en Railway).
 */
export function getSessionCookieSetOptions(): SessionCookieSetOptions {
    const maxAge = config.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    const domain = (process.env.SESSION_COOKIE_DOMAIN || '').trim() || undefined;

    if (config.NODE_ENV !== 'production') {
        return {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge,
            path: '/',
            ...(domain ? { domain } : {}),
        };
    }

    const raw = (process.env.SESSION_COOKIE_SAMESITE || 'none').trim().toLowerCase();
    const sameSite: 'lax' | 'none' | 'strict' =
        raw === 'lax' ? 'lax' : raw === 'strict' ? 'strict' : 'none';
    let secure = process.env.SESSION_COOKIE_SECURE === '0' ? false : true;
    if (sameSite === 'none') {
        secure = true;
    }
    return {
        httpOnly: true,
        secure,
        sameSite,
        maxAge,
        path: '/',
        ...(domain ? { domain } : {}),
    };
}

/** Mismos flags que al setear, para que `clearCookie` sea efectivo en todos los navegadores. */
export function getSessionCookieClearOptions(): {
    path: '/';
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'none' | 'strict';
    domain?: string;
} {
    const o = getSessionCookieSetOptions();
    return {
        path: '/',
        httpOnly: o.httpOnly,
        secure: o.secure,
        sameSite: o.sameSite,
        ...(o.domain ? { domain: o.domain } : {}),
    };
}
