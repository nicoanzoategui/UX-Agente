import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.js';

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Límite por IP (ventana fija). Valores: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` en env.
 * Sin dependencias extra; apto para un solo proceso. Tras un proxy, `TRUST_PROXY` + `trust proxy` en Express.
 */
export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
    const windowMs = config.RATE_LIMIT_WINDOW_MS;
    const maxPerWindow = config.RATE_LIMIT_MAX;
    const now = Date.now();
    const key = clientKey(req);
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
        b = { count: 0, windowStart: now };
        buckets.set(key, b);
    }
    b.count += 1;
    const resetAtSec = Math.ceil((b.windowStart + windowMs) / 1000);
    res.setHeader('X-RateLimit-Limit', String(maxPerWindow));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxPerWindow - b.count)));
    res.setHeader('X-RateLimit-Reset', String(resetAtSec));
    if (b.count > maxPerWindow) {
        const retrySec = Math.max(1, Math.ceil((windowMs - (now - b.windowStart)) / 1000));
        res.setHeader('Retry-After', String(retrySec));
        res.status(429).json({ error: 'Demasiadas solicitudes; probá de nuevo en unos minutos.' });
        return;
    }
    next();
}
