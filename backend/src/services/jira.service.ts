// backend/src/services/jira.service.ts

import { config } from '../config/env.js';
import { queryAll, queryOne, run } from '../db/database.js';

const JIRA_BASE_URL = `https://${config.JIRA_HOST}/rest/api/3`;

const headers = {
    'Authorization': `Basic ${Buffer.from(`${config.JIRA_EMAIL}:${config.JIRA_API_TOKEN}`).toString('base64')}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

function parseStatusTargets(csv: string | undefined): string[] {
    return (csv || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * Cambia el issue a un estado destino buscando una transición cuyo estado `to.name`
 * coincida con alguno de los nombres configurados (insensible a mayúsculas).
 */
export async function transitionIssueToTargetStatus(
    issueKey: string,
    targetStatusCsv: string | undefined
): Promise<boolean> {
    const targets = parseStatusTargets(targetStatusCsv);
    if (targets.length === 0) return false;

    const listRes = await fetch(`${JIRA_BASE_URL}/issue/${encodeURIComponent(issueKey)}/transitions`, {
        headers,
    });
    if (!listRes.ok) {
        const err = await listRes.text();
        console.warn(`Jira transitions list failed (${issueKey}): ${listRes.status}`, err.slice(0, 400));
        return false;
    }

    const data = (await listRes.json()) as {
        transitions?: Array<{ id: string; name: string; to?: { name?: string } }>;
    };
    const transitions = data.transitions || [];

    const match =
        transitions.find((t) => {
            const toName = (t.to?.name || '').toLowerCase();
            return targets.some((target) => toName === target);
        }) ||
        transitions.find((t) => {
            const toName = (t.to?.name || '').toLowerCase();
            return targets.some((target) => toName.includes(target));
        }) ||
        // Respaldo: nombre del botón de transición (p. ej. "In progress") vs estado destino.
        transitions.find((t) => {
            const btn = (t.name || '').toLowerCase();
            return targets.some((target) => target.length >= 3 && btn.includes(target));
        });

    if (!match) {
        const available = transitions.map((t) => `${t.name}→${t.to?.name ?? '?'}`).join(' | ');
        console.warn(
            `No hay transición hacia [${targets.join(', ')}] para ${issueKey}. Disponibles: ${available || '(ninguna)'}`
        );
        return false;
    }

    const postRes = await fetch(`${JIRA_BASE_URL}/issue/${encodeURIComponent(issueKey)}/transitions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transition: { id: match.id } }),
    });

    if (!postRes.ok) {
        const err = await postRes.text();
        console.warn(`Jira transition POST failed (${issueKey}): ${postRes.status}`, err.slice(0, 400));
        return false;
    }

    console.log(`✓ Jira ${issueKey}: transición "${match.name}" → ${match.to?.name}`);
    return true;
}

/**
 * Después de marcar una fase en "Hecho", prepara el siguiente ciclo Kanban en el **mismo** ticket:
 * Por hacer → En curso (el agente va a generar el siguiente nivel).
 * Requiere en Jira una transición desde Hecho hacia "Por hacer" (p. ej. "Reabrir" / "Reopen").
 */
export async function prepareBoardForNextDesignPhase(issueKey: string): Promise<void> {
    await transitionIssueToTargetStatus(issueKey, config.JIRA_WORKFLOW_STATUS_TODO);
    await transitionIssueToTargetStatus(issueKey, config.JIRA_WORKFLOW_STATUS_IN_PROGRESS);
}

/**
 * Pone el ticket en "En curso" cuando el agente arranca trabajo.
 * Si no hay transición directa (p. ej. está en otro estado), intenta Por hacer → En curso.
 */
export async function transitionAgentPickUpIssue(issueKey: string): Promise<void> {
    let ok = await transitionIssueToTargetStatus(issueKey, config.JIRA_WORKFLOW_STATUS_IN_PROGRESS);
    if (!ok) {
        console.warn(`Jira (${issueKey}): sin transición directa a En curso; probando vía Por hacer…`);
        await transitionIssueToTargetStatus(issueKey, config.JIRA_WORKFLOW_STATUS_TODO);
        ok = await transitionIssueToTargetStatus(issueKey, config.JIRA_WORKFLOW_STATUS_IN_PROGRESS);
    }
    if (!ok) {
        console.warn(
            `Jira (${issueKey}): no se pudo pasar a En curso. Revisá nombres en JIRA_WORKFLOW_STATUS_IN_PROGRESS / TODO y las transiciones del workflow.`
        );
    }
}

async function jiraSearchKeysByJql(jql: string): Promise<string[]> {
    const params = new URLSearchParams({ jql, maxResults: '50', fields: 'key' });
    const urls = [`${JIRA_BASE_URL}/search/jql?${params}`, `${JIRA_BASE_URL}/search?${params}`];
    for (const url of urls) {
        const response = await fetch(url, { headers });
        if (!response.ok) continue;
        const data = (await response.json()) as { issues?: { key: string }[] };
        return (data.issues || []).map((i) => i.key);
    }
    return [];
}

export async function jiraIssueExists(issueKey: string): Promise<boolean> {
    const res = await fetch(
        `${JIRA_BASE_URL}/issue/${encodeURIComponent(issueKey)}?fields=key`,
        { headers }
    );
    return res.ok;
}

async function purgeLocalStory(localId: string, jiraKey: string): Promise<void> {
    await run('DELETE FROM design_outputs WHERE story_id = ?', [localId]);
    await run('DELETE FROM user_stories WHERE id = ?', [localId]);
    console.log(`✓ Eliminada copia local ${jiraKey} (el issue ya no existe en Jira)`);
}

/**
 * Quita de Turso/local las historias cuyo `jira_key` ya no aparece en Jira (borradas o sin permiso).
 */
export async function reconcileUserStoriesWithJira(): Promise<void> {
    const rows = await queryAll<{ id: string; jira_key: string }>(
        'SELECT id, jira_key FROM user_stories'
    );
    if (rows.length === 0) return;

    const stillInJira = new Set<string>();
    const chunkSize = 35;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const jql = `key in (${chunk.map((r) => r.jira_key).join(',')})`;
        const keys = await jiraSearchKeysByJql(jql);
        keys.forEach((k) => stillInJira.add(k));
    }

    for (const row of rows) {
        if (!stillInJira.has(row.jira_key)) {
            await purgeLocalStory(row.id, row.jira_key);
        }
    }
}

/** Si el issue no existe, borra fila local y devuelve false. */
export async function ensureJiraIssueExistsOrRemoveLocal(
    localId: string,
    jiraKey: string
): Promise<boolean> {
    if (await jiraIssueExists(jiraKey)) return true;
    await purgeLocalStory(localId, jiraKey);
    return false;
}

// Buscar issues pendientes de diseño
export async function fetchPendingStories(): Promise<any[]> {
    const jql = `project = ${config.JIRA_PROJECT_KEY} AND labels = "${config.JIRA_DESIGN_LABEL}" ORDER BY created DESC`;
    const fields = 'summary,description,labels,subtasks,status';
    const params = new URLSearchParams({
        jql,
        maxResults: '50',
        fields,
    });

    const url = `${JIRA_BASE_URL}/search/jql?${params}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn(
            `Jira search failed (${url.split('?')[0]}): ${response.status} ${response.statusText}`,
            errorText.slice(0, 500)
        );
        return [];
    }

    const data = (await response.json()) as { issues?: any[] };
    return data.issues || [];
}

// Agregar comentario
export async function addComment(issueKey: string, comment: string): Promise<void> {
    const response = await fetch(
        `${JIRA_BASE_URL}/issue/${issueKey}/comment`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                body: {
                    type: 'doc',
                    version: 1,
                    content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: comment }]
                    }]
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to add comment: ${error}`);
    }
}

// Subir adjunto
export async function uploadAttachment(issueKey: string, filename: string, content: string, mimeType: string): Promise<string> {
    const blob = new Blob([content], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename);

    const response = await fetch(
        `${JIRA_BASE_URL}/issue/${issueKey}/attachments`,
        {
            method: 'POST',
            headers: {
                'Authorization': headers.Authorization,
                'X-Atlassian-Token': 'no-check',
            },
            body: formData,
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload attachment: ${error}`);
    }

    const data = await response.json() as any;
    return data[0]?.id || '';
}

// Actualizar labels
export async function updateLabels(issueKey: string, addLabels: string[], removeLabels: string[]): Promise<void> {
    const response = await fetch(
        `${JIRA_BASE_URL}/issue/${issueKey}`,
        {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                update: {
                    labels: [
                        ...addLabels.map(l => ({ add: l })),
                        ...removeLabels.map(l => ({ remove: l })),
                    ]
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update labels: ${error}`);
    }
}

/**
 * Jira polling function.
 * @param intervalMs polling interval in ms.
 * @note This is called by src/index.ts
 */
export function startPolling(intervalMs: number): void {
    console.log(`✓ Jira polling started (every ${intervalMs / 1000}s)`);

    const poll = async () => {
        try {
            const { processNewStory } = await import('./agent.service.js');
            const stories = await fetchPendingStories();

            for (const story of stories) {
                const existing = await queryOne<any>(
                    'SELECT id FROM user_stories WHERE jira_key = ?',
                    [story.key]
                );

                if (!existing) {
                    console.log(`→ New story detected: ${story.key}`);
                    await processNewStory(story);
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };

    // Poll immediately, then on interval
    poll();
    setInterval(poll, intervalMs);
}
