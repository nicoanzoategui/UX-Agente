// backend/src/services/agent.service.ts

import { v4 as uuid } from 'uuid';
import { queryOne, run } from '../db/database.js';
import { generateDesign } from './llm.service.js';
import {
    addComment,
    prepareBoardForNextDesignPhase,
    uploadAttachment,
    transitionAgentPickUpIssue,
    transitionIssueToTargetStatus,
    updateLabels,
} from './jira.service.js';
import { config } from '../config/env.js';

const LEVEL_NAMES: Record<number, string> = {
    1: 'Wireframe',
    2: 'Wireframe Alta',
    3: 'UI High Fidelity'
};

const LEVEL_EXTENSIONS: Record<number, string> = {
    1: 'svg',
    2: 'svg',
    3: 'tsx'
};

const LEVEL_MIME: Record<number, string> = {
    1: 'image/svg+xml',
    2: 'image/svg+xml',
    3: 'text/plain'
};

/** Convierte ADF (Jira Cloud) a texto plano; cubre párrafos, listas, headings anidados. */
function adfNodeToText(node: any): string {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && node.type === 'hardBreak') return '\n';
    if (typeof node === 'object' && 'text' in node && typeof node.text === 'string') {
        return node.text;
    }
    if (Array.isArray(node)) {
        return node.map(adfNodeToText).join('');
    }
    if (typeof node === 'object' && Array.isArray(node.content)) {
        return adfNodeToText(node.content);
    }
    return '';
}

function extractJiraDescription(fields: any): string {
    const desc = fields?.description;
    if (!desc) return '';
    if (typeof desc === 'string') return desc;
    if (typeof desc === 'object' && desc.type === 'doc' && Array.isArray(desc.content)) {
        return desc.content
            .map((block: any) => adfNodeToText(block).trim())
            .filter(Boolean)
            .join('\n');
    }
    if (typeof desc === 'object' && Array.isArray(desc.content)) {
        return desc.content
            .map((block: any) => adfNodeToText(block).trim())
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

/**
 * Marca la story como "generando" en la API para que el front muestre spinner (Gemini tarda).
 */
export async function runWithGeneratingFlag(storyId: string, fn: () => Promise<void>): Promise<void> {
    await run(
        `UPDATE user_stories SET is_generating = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [storyId]
    );
    try {
        await fn();
    } finally {
        await run(
            `UPDATE user_stories SET is_generating = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [storyId]
        );
    }
}

// Procesar nueva user story
export async function processNewStory(jiraIssue: any): Promise<void> {
    const storyId = uuid();

    await transitionAgentPickUpIssue(jiraIssue.key);

    const description = extractJiraDescription(jiraIssue.fields);

    try {
        await run(
            `INSERT INTO user_stories (id, jira_key, jira_id, title, description, status, current_level, is_generating)
     VALUES (?, ?, ?, ?, ?, 'in_progress', 0, 1)`,
            [storyId, jiraIssue.key, jiraIssue.id, jiraIssue.fields.summary, description]
        );

        await addComment(
            jiraIssue.key,
            `🤖 *Design Agent iniciado*\n\nComenzando a generar diseños para esta user story.\n\n` +
                `Niveles: Wireframe → Wireframe Alta → UI High-Fi\n\n` +
                `Los diseños se adjuntarán a este ticket para revisión.`
        );

        await transitionAgentPickUpIssue(jiraIssue.key);

        try {
            await generateAndUpload(storyId, 1);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Design generation failed for ${jiraIssue.key}:`, err);
            try {
                await addComment(
                    jiraIssue.key,
                    `⚠️ *Error al generar el primer diseño (Gemini)*\n\n` +
                        `${msg.slice(0, 3500)}\n\n` +
                        `Revisá GEMINI_API_KEY, GEMINI_MODEL en el backend y los logs del servidor.`
                );
            } catch (commentErr) {
                console.error('Could not post error comment to Jira:', commentErr);
            }
        }
    } finally {
        await run(
            `UPDATE user_stories SET is_generating = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [storyId]
        );
    }
}

// Generar diseño y subir a Jira
export async function generateAndUpload(
    storyId: string,
    level: 1 | 2 | 3,
    feedback?: string
): Promise<void> {
    const story = await queryOne<any>(
        'SELECT * FROM user_stories WHERE id = ?',
        [storyId]
    );
    if (!story) throw new Error('Story not found');

    await transitionAgentPickUpIssue(story.jira_key);

    console.log(`→ Generating ${LEVEL_NAMES[level]} for ${story.jira_key}...`);

    // Obtener diseño anterior si estamos iterando
    const previousOutput = await queryOne<any>(
        `SELECT content FROM design_outputs 
     WHERE story_id = ? AND level = ? 
     ORDER BY version DESC LIMIT 1`,
        [storyId, level]
    );

    // Obtener versión actual
    const versionResult = await queryOne<any>(
        'SELECT MAX(version) as v FROM design_outputs WHERE story_id = ? AND level = ?',
        [storyId, level]
    );
    const version = (versionResult?.v || 0) + 1;

    // Generar diseño con LLM
    const content = await generateDesign(
        `${story.title}\n\n${story.description}`,
        level,
        feedback,
        previousOutput?.content
    );

    // Guardar en DB
    const outputId = uuid();
    const contentType = level === 3 ? 'code' : 'svg';
    const filename = `${LEVEL_NAMES[level].toLowerCase().replace(/ /g, '-')}-v${version}.${LEVEL_EXTENSIONS[level]}`;

    await run(
        `INSERT INTO design_outputs (id, story_id, level, content, content_type, version, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [outputId, storyId, level, content, contentType, version]
    );

    // Subir a Jira
    try {
        const attachmentId = await uploadAttachment(
            story.jira_key,
            filename,
            content,
            LEVEL_MIME[level]
        );

        await run(
            'UPDATE design_outputs SET jira_attachment_id = ? WHERE id = ?',
            [attachmentId, outputId]
        );
    } catch (err) {
        console.error(`Error uploading attachment for ${story.jira_key}:`, err);
    }

    // Comentar pidiendo aprobación
    await addComment(
        story.jira_key,
        `🎨 *${LEVEL_NAMES[level]}* (v${version}) generado — fase ${level}/3\n\n` +
        `Revisá el archivo adjunto: ${filename}\n\n` +
        `Para aprobar o dar feedback, usá el dashboard:\n` +
        `${config.FRONTEND_URL}/review/${storyId}`
    );

    if (config.JIRA_MOVE_TO_TODO_AFTER_DELIVERY) {
        await transitionIssueToTargetStatus(story.jira_key, config.JIRA_WORKFLOW_STATUS_TODO);
    }

    // Actualizar nivel actual
    await run(
        'UPDATE user_stories SET current_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [level, storyId]
    );

    console.log(`✓ ${LEVEL_NAMES[level]} v${version} uploaded for ${story.jira_key}`);
}

// Aprobar diseño
export async function handleApproval(storyId: string, outputId: string): Promise<void> {
    const story = await queryOne<any>('SELECT * FROM user_stories WHERE id = ?', [storyId]);
    const output = await queryOne<any>('SELECT * FROM design_outputs WHERE id = ?', [outputId]);

    if (!story || !output) throw new Error('Not found');

    // Marcar como aprobado
    await run('UPDATE design_outputs SET status = ? WHERE id = ?', ['approved', outputId]);

    const nextLevel = (output.level + 1) as 1 | 2 | 3;

    // ¿Siguiente nivel o terminamos?
    if (output.level < 3) {
        await addComment(
            story.jira_key,
            `✅ *${LEVEL_NAMES[output.level]}* aprobado — fase ${output.level}/3 cerrada (Hecho en tablero).\n\n` +
                `▶ Siguiente fase: *${LEVEL_NAMES[nextLevel]}* (${nextLevel}/3). Pasando por Kanban y generando…`
        );
        await transitionIssueToTargetStatus(story.jira_key, config.JIRA_WORKFLOW_STATUS_DONE);
        await prepareBoardForNextDesignPhase(story.jira_key);

        try {
            await runWithGeneratingFlag(storyId, () => generateAndUpload(storyId, nextLevel));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`generateAndUpload failed after approval (${story.jira_key}):`, err);
            await addComment(
                story.jira_key,
                `⚠️ *Error al generar el siguiente nivel*\n\n${msg.slice(0, 3500)}`
            );
        }
    } else {
        await addComment(
            story.jira_key,
            `✅ *${LEVEL_NAMES[output.level]}* aprobado — última fase (3/3). Marcando historia como completada en Jira.`
        );
        // Completado
        await run('UPDATE user_stories SET status = ? WHERE id = ?', ['completed', storyId]);
        await transitionIssueToTargetStatus(story.jira_key, config.JIRA_WORKFLOW_STATUS_DONE);
        await updateLabels(story.jira_key, ['design-done'], ['design-pending']);
        await addComment(
            story.jira_key,
            `🎉 *Diseño completado*\n\n` +
            `Los 3 niveles fueron aprobados:\n` +
            `✓ Wireframe\n` +
            `✓ Wireframe Alta\n` +
            `✓ UI High Fidelity\n\n` +
            `El código del componente está adjunto y listo para desarrollo.`
        );
    }
}

// Rechazar con feedback
export async function handleRejection(storyId: string, outputId: string, feedback: string): Promise<void> {
    const story = await queryOne<any>('SELECT * FROM user_stories WHERE id = ?', [storyId]);
    const output = await queryOne<any>('SELECT * FROM design_outputs WHERE id = ?', [outputId]);

    if (!story || !output) throw new Error('Not found');

    // Marcar como rechazado
    await run(
        'UPDATE design_outputs SET status = ?, feedback = ? WHERE id = ?',
        ['rejected', feedback, outputId]
    );

    // Comentar en Jira
    await addComment(
        story.jira_key,
        `🔄 *Feedback recibido para ${LEVEL_NAMES[output.level]}*\n\n"${feedback}"\n\nGenerando nueva versión...`
    );

    // Generar nueva versión
    try {
        await runWithGeneratingFlag(storyId, () =>
            generateAndUpload(storyId, output.level as 1 | 2 | 3, feedback)
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`generateAndUpload failed after rejection (${story.jira_key}):`, err);
        await addComment(
            story.jira_key,
            `⚠️ *Error al regenerar tras el feedback*\n\n${msg.slice(0, 3500)}`
        );
    }
}
