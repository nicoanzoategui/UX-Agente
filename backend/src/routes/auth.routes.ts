import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { getSessionCookieClearOptions, getSessionCookieSetOptions } from '../config/session-cookie.js';
import { loginWithGoogleIdToken } from '../services/google-auth.service.js';
import { type AuthSession } from '../middleware/require-auth.js';
import { TEAM_WORKSPACE_ID } from '../constants/team.js';

const router = Router();

router.post('/google', async (req, res) => {
    try {
        if (config.AUTH_DISABLED) {
            const session: AuthSession = {
                userId: '00000000-0000-4000-8000-000000000099',
                workspaceId: TEAM_WORKSPACE_ID,
                email: 'dev@local',
                name: 'Dev',
            };
            const token = jwt.sign(
                { sub: session.userId, wid: session.workspaceId, email: session.email, name: session.name },
                config.JWT_SECRET || 'dev-insecure',
                { expiresIn: `${config.JWT_EXPIRES_DAYS}d` }
            );
            res.cookie(config.SESSION_COOKIE_NAME, token, getSessionCookieSetOptions());
            res.json({ ok: true, user: { id: session.userId, email: session.email, name: session.name } });
            return;
        }

        const credential = (req.body as { credential?: string }).credential;
        if (!credential?.trim()) {
            return res.status(400).json({ error: 'credential (ID token de Google) requerido' });
        }
        if (!config.JWT_SECRET || config.JWT_SECRET.length < 8) {
            return res.status(500).json({ error: 'JWT_SECRET no configurado en el servidor' });
        }

        const session = await loginWithGoogleIdToken(credential.trim());
        const token = jwt.sign(
            {
                sub: session.userId,
                wid: session.workspaceId,
                email: session.email,
                name: session.name,
            },
            config.JWT_SECRET,
            { expiresIn: `${config.JWT_EXPIRES_DAYS}d` }
        );
        res.cookie(config.SESSION_COOKIE_NAME, token, getSessionCookieSetOptions());
        res.json({
            ok: true,
            user: { id: session.userId, email: session.email, name: session.name },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error de autenticación';
        res.status(401).json({ error: msg });
    }
});

router.post('/logout', (_req, res) => {
    res.clearCookie(config.SESSION_COOKIE_NAME, getSessionCookieClearOptions());
    res.json({ ok: true });
});

router.get('/me', (req, res) => {
    if (config.AUTH_DISABLED) {
        res.json({
            user: {
                id: '00000000-0000-4000-8000-000000000099',
                email: 'dev@local',
                name: 'Dev (AUTH_DISABLED)',
            },
        });
        return;
    }
    const raw = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (!raw || !config.JWT_SECRET) {
        res.json({ user: null });
        return;
    }
    try {
        const payload = jwt.verify(raw, config.JWT_SECRET) as {
            sub: string;
            email: string;
            name?: string;
        };
        res.json({
            user: { id: payload.sub, email: payload.email, name: payload.name || '' },
        });
    } catch {
        res.json({ user: null });
    }
});

export default router;
