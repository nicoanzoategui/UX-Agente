import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { TEAM_WORKSPACE_ID } from '../constants/team.js';

export type AuthSession = {
    userId: string;
    workspaceId: string;
    email: string;
    name: string;
};

type JwtPayload = {
    sub: string;
    wid: string;
    email: string;
    name?: string;
};

const DEV_USER_ID = '00000000-0000-4000-8000-000000000099';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (config.AUTH_DISABLED) {
        (req as Request & { auth: AuthSession }).auth = {
            userId: DEV_USER_ID,
            workspaceId: TEAM_WORKSPACE_ID,
            email: 'dev@local',
            name: 'Dev (AUTH_DISABLED)',
        };
        next();
        return;
    }

    const raw = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (!raw) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    if (!config.JWT_SECRET) {
        res.status(500).json({ error: 'Servidor sin JWT_SECRET configurado' });
        return;
    }
    try {
        const payload = jwt.verify(raw, config.JWT_SECRET) as JwtPayload;
        if (!payload.sub || !payload.wid || !payload.email) {
            throw new Error('Token incompleto');
        }
        (req as Request & { auth: AuthSession }).auth = {
            userId: payload.sub,
            workspaceId: payload.wid,
            email: payload.email,
            name: payload.name || '',
        };
        next();
    } catch {
        res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
}

export function getAuth(req: Request): AuthSession {
    const a = (req as Request & { auth?: AuthSession }).auth;
    if (!a) throw new Error('requireAuth no ejecutado');
    return a;
}
