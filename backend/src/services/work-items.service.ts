import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import type { FlowStep, KanbanColumn } from './flow-step.js';

const WS = ' AND workspace_id = ?';

export type WorkItemKind = 'spec' | 'wireframe_low' | 'wireframe_high' | 'flowbite';

export const WORK_ITEM_KINDS: WorkItemKind[] = [
    'spec',
    'wireframe_low',
    'wireframe_high',
    'flowbite',
];

export type KickoffWorkItemRow = {
    id: string;
    card_id: string;
    workspace_id: string;
    kind: WorkItemKind;
    kanban_column: KanbanColumn;
    is_generating: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

/** Columna y flag generating por tarea según el paso global de la tarjeta. */
function workItemSnapshot(
    step: FlowStep,
    cardIsGenerating: boolean,
    parentColumn: KanbanColumn
): Record<WorkItemKind, { col: KanbanColumn; gen: boolean }> {
    const g = cardIsGenerating;
    switch (step) {
        case 'transcript':
            return {
                spec: { col: parentColumn, gen: false },
                wireframe_low: { col: 'todo', gen: false },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'spec_generating':
            return {
                spec: { col: 'wip', gen: g },
                wireframe_low: { col: 'todo', gen: false },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'gate_spec':
            return {
                spec: { col: 'todo', gen: false },
                wireframe_low: { col: 'todo', gen: false },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'wireframes_generating':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'wip', gen: g },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'gate_wireframes':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'review', gen: false },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'hifi_generating':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'done', gen: false },
                wireframe_high: { col: 'wip', gen: g },
                flowbite: { col: 'todo', gen: false },
            };
        case 'gate_hifi':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'done', gen: false },
                wireframe_high: { col: 'review', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
        case 'flowbite_generating':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'done', gen: false },
                wireframe_high: { col: 'done', gen: false },
                flowbite: { col: 'wip', gen: g },
            };
        case 'gate_flowbite':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'done', gen: false },
                wireframe_high: { col: 'done', gen: false },
                flowbite: { col: 'review', gen: false },
            };
        case 'completed':
            return {
                spec: { col: 'done', gen: false },
                wireframe_low: { col: 'done', gen: false },
                wireframe_high: { col: 'done', gen: false },
                flowbite: { col: 'done', gen: false },
            };
        default:
            return {
                spec: { col: 'todo', gen: false },
                wireframe_low: { col: 'todo', gen: false },
                wireframe_high: { col: 'todo', gen: false },
                flowbite: { col: 'todo', gen: false },
            };
    }
}

export async function ensureWorkItemsForCard(cardId: string, workspaceId: string): Promise<void> {
    for (let i = 0; i < WORK_ITEM_KINDS.length; i++) {
        const kind = WORK_ITEM_KINDS[i];
        const row = await queryOne<{ id: string }>(
            `SELECT id FROM kickoff_work_items WHERE card_id = ? AND kind = ?`,
            [cardId, kind]
        );
        if (row) continue;
        await run(
            `INSERT INTO kickoff_work_items (id, card_id, workspace_id, kind, kanban_column, is_generating, sort_order)
             VALUES (?, ?, ?, ?, 'todo', 0, ?)`,
            [uuid(), cardId, workspaceId, kind, i]
        );
    }
}

export async function syncWorkItemsFromCardState(cardId: string, workspaceId: string): Promise<void> {
    await ensureWorkItemsForCard(cardId, workspaceId);
    const c = await queryOne<{
        current_step: string;
        is_generating: number;
        kanban_column: string;
    }>(`SELECT current_step, is_generating, kanban_column FROM kickoff_cards WHERE id = ?${WS}`, [
        cardId,
        workspaceId,
    ]);
    if (!c) return;
    const parentCol = (c.kanban_column || 'todo') as KanbanColumn;
    const snap = workItemSnapshot(
        c.current_step as FlowStep,
        Number(c.is_generating) === 1,
        parentCol
    );
    for (const kind of WORK_ITEM_KINDS) {
        const s = snap[kind];
        await run(
            `UPDATE kickoff_work_items SET kanban_column = ?, is_generating = ?, updated_at = CURRENT_TIMESTAMP
             WHERE card_id = ? AND workspace_id = ? AND kind = ?`,
            [s.col, s.gen ? 1 : 0, cardId, workspaceId, kind]
        );
    }
}

export async function listWorkItemsForWorkspace(workspaceId: string): Promise<KickoffWorkItemRow[]> {
    return queryAll<KickoffWorkItemRow>(
        `SELECT w.* FROM kickoff_work_items w
         INNER JOIN kickoff_cards c ON c.id = w.card_id AND c.workspace_id = w.workspace_id
         WHERE w.workspace_id = ?
         ORDER BY c.updated_at DESC, w.sort_order ASC`,
        [workspaceId]
    );
}

export async function listWorkItemsForCard(cardId: string, workspaceId: string): Promise<KickoffWorkItemRow[]> {
    return queryAll<KickoffWorkItemRow>(
        `SELECT * FROM kickoff_work_items WHERE card_id = ? AND workspace_id = ? ORDER BY sort_order`,
        [cardId, workspaceId]
    );
}

/** Migra tarjetas existentes sin filas de tareas. */
export async function backfillWorkItemsAllCards(): Promise<void> {
    const cards = await queryAll<{ id: string; workspace_id: string }>(
        `SELECT id, workspace_id FROM kickoff_cards`
    );
    for (const c of cards) {
        await ensureWorkItemsForCard(c.id, c.workspace_id);
        await syncWorkItemsFromCardState(c.id, c.workspace_id);
    }
}
