// backend/src/config/env.ts

import dotenv from 'dotenv';
dotenv.config();

export const config = {
    PORT: process.env.PORT || 3001,

    // Jira
    JIRA_HOST: process.env.JIRA_HOST!,
    JIRA_EMAIL: process.env.JIRA_EMAIL!,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN!,
    JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY!,
    JIRA_DESIGN_LABEL: process.env.JIRA_DESIGN_LABEL || 'design-pending',

    /**
     * Columna "Por hacer" / backlog (coma). Tras subir cada diseño, el ticket vuelve acá hasta que apruebes en el dashboard
     * (si JIRA_MOVE_TO_TODO_AFTER_DELIVERY no es false).
     */
    JIRA_WORKFLOW_STATUS_TODO:
        process.env.JIRA_WORKFLOW_STATUS_TODO || 'Por hacer,To Do,Backlog',
    /** Nombres del estado "En curso" (coma). Deben coincidir con el nombre del estado destino en Jira (no el de la columna si difiere). */
    JIRA_WORKFLOW_STATUS_IN_PROGRESS:
        process.env.JIRA_WORKFLOW_STATUS_IN_PROGRESS ||
        'En curso,In Progress,Doing,En progreso,En Progreso,Iniciado',
    /** Estado "Hecho" al cerrar cada fase con aprobación (y al completar el nivel 3). */
    JIRA_WORKFLOW_STATUS_DONE:
        process.env.JIRA_WORKFLOW_STATUS_DONE || 'Hecho,Done',
    /**
     * Tras adjuntar cada nivel: mover a Por hacer para revisión en el front.
     * Poné `false` si tu flujo no tiene transición En curso → Por hacer.
     */
    JIRA_MOVE_TO_TODO_AFTER_DELIVERY: process.env.JIRA_MOVE_TO_TODO_AFTER_DELIVERY !== 'false',

    // Gemini
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    /**
     * Mismo modelo que suele usar Antigravity (preview). Si falla o 429: `gemini-2.5-flash`, `gemini-2.5-flash-lite`.
     * Docs: https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview
     */
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',

    // Turso
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL!,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN!,

    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};

// Validate required vars
const required = ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY',
    'GEMINI_API_KEY', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
for (const key of required) {
    if (!process.env[key]) {
        console.warn(`Missing required env var: ${key}. The application may fail at runtime.`);
    }
}
