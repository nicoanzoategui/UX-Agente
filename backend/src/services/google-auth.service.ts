import { OAuth2Client } from 'google-auth-library';
import { v4 as uuid } from 'uuid';
import { queryOne, run } from '../db/database.js';
import { config } from '../config/env.js';
import { TEAM_WORKSPACE_ID } from '../constants/team.js';

function isEmailAllowed(email: string): boolean {
    if (config.ALLOWED_EMAILS.length > 0) {
        return config.ALLOWED_EMAILS.includes(email);
    }
    if (config.ALLOWED_EMAIL_DOMAIN) {
        return email.endsWith(config.ALLOWED_EMAIL_DOMAIN);
    }
    return true;
}

export type SessionUser = {
    userId: string;
    workspaceId: string;
    email: string;
    name: string;
};

/**
 * Verifica el ID token de Google (botón GIS en el front), crea/actualiza usuario y lo asocia al workspace del equipo.
 */
export async function loginWithGoogleIdToken(idToken: string): Promise<SessionUser> {
    if (!config.GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth no configurado (GOOGLE_CLIENT_ID)');
    }
    const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email || !p.sub) {
        throw new Error('Token de Google inválido');
    }
    const email = p.email.toLowerCase();
    if (!isEmailAllowed(email)) {
        throw new Error('Tu cuenta no está autorizada para este equipo');
    }

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE google_sub = ?', [p.sub]);
    let userId: string;
    if (existing) {
        userId = existing.id;
        await run(`UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?`, [
            email,
            p.name || '',
            p.picture || '',
            userId,
        ]);
    } else {
        userId = uuid();
        await run(
            `INSERT INTO users (id, email, name, picture, google_sub) VALUES (?, ?, ?, ?, ?)`,
            [userId, email, p.name || '', p.picture || '', p.sub]
        );
    }

    await run(
        `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')`,
        [TEAM_WORKSPACE_ID, userId]
    );

    return {
        userId,
        workspaceId: TEAM_WORKSPACE_ID,
        email,
        name: (p.name || '').trim() || email.split('@')[0] || 'Usuario',
    };
}
