import { v4 as uuid } from 'uuid';
import { db, queryAll, queryOne, run } from '../db/database.js';
import { generateHifiWireframeViaAIDesigner } from './aidesigner.service.js';
import type { FlowStep, KanbanColumn } from './flow-step.js';
import {
    generateFlowbiteDesignFromHifi,
    generateHifiWireframeFromSpecAndLowFi,
    generateSpecFromTranscript,
    generateWireframeOptionsFromSpec,
} from './llm.service.js';
import { config } from '../config/env.js';
import { syncWorkItemsFromCardState } from './work-items.service.js';

export type { FlowStep, KanbanColumn } from './flow-step.js';

const MAX_GEN_ERROR_LEN = 4000;

function serializeFlowbiteMetadata(o: {
    title: string;
    description: string;
    components?: string;
}): string {
    return JSON.stringify({
        title: (o.title || '').trim(),
        description: (o.description || '').trim(),
        components: (o.components || '').trim(),
    });
}

/** Fragmento SQL: acota por workspace (tarjetas multi-tenant). */
const WS = ' AND workspace_id = ?';

function formatGenerationError(err: unknown): string {
    if (err instanceof Error && err.message.trim()) {
        return err.message.trim().slice(0, MAX_GEN_ERROR_LEN);
    }
    const s = String(err ?? 'Error desconocido').trim();
    return s.slice(0, MAX_GEN_ERROR_LEN);
}

function deriveKanbanColumn(step: FlowStep, isGenerating: boolean): KanbanColumn {
    if (isGenerating) return 'wip';
    switch (step) {
        case 'transcript':
            return 'todo';
        case 'spec_generating':
        case 'wireframes_generating':
        case 'hifi_generating':
        case 'flowbite_generating':
            return 'wip';
        /** Spec listo para revisar: va a To Do como tarea independiente (no Revisión). */
        case 'gate_spec':
            return 'todo';
        case 'gate_wireframes':
        case 'gate_hifi':
        case 'gate_flowbite':
            return 'review';
        case 'completed':
            return 'done';
        default:
            return 'todo';
    }
}

export async function syncKanbanColumn(cardId: string, workspaceId: string): Promise<void> {
    const c = await queryOne<{ current_step: string; is_generating: number }>(
        `SELECT current_step, is_generating FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!c) return;
    const col = deriveKanbanColumn(c.current_step as FlowStep, Number(c.is_generating) === 1);
    await run(
        `UPDATE kickoff_cards SET kanban_column = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [col, cardId, workspaceId]
    );
    await syncWorkItemsFromCardState(cardId, workspaceId);
}

export async function runWithGeneratingFlag(
    cardId: string,
    workspaceId: string,
    fn: () => Promise<void>
): Promise<void> {
    await run(
        `UPDATE kickoff_cards SET is_generating = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    try {
        await fn();
    } finally {
        await run(
            `UPDATE kickoff_cards SET is_generating = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
    }
}

export async function runSpecGeneration(
    cardId: string,
    workspaceId: string,
    feedback?: string
): Promise<void> {
    const card = await queryOne<{
        id: string;
        transcript: string;
        current_step: string;
    }>(`SELECT id, transcript, current_step FROM kickoff_cards WHERE id = ?${WS}`, [cardId, workspaceId]);

    if (!card) throw new Error('Card not found');
    if (!card.transcript?.trim()) throw new Error('Transcripción vacía');

    await run(
        `UPDATE kickoff_cards SET current_step = 'spec_generating', gate_spec_status = 'pending',
         gate_spec_comment = NULL, restart_from = NULL, last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const spec = await generateSpecFromTranscript(card.transcript, feedback);
            await run(
                `UPDATE kickoff_cards SET spec_markdown = ?, current_step = 'gate_spec',
           gate_spec_status = 'pending', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [spec, cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`runSpecGeneration failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'transcript', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
}

export async function approveSpecGate(cardId: string, workspaceId: string): Promise<void> {
    const card = await queryOne<{ current_step: string; spec_markdown: string | null }>(
        `SELECT current_step, spec_markdown FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card || card.current_step !== 'gate_spec') {
        throw new Error('La tarjeta no está en revisión de spec');
    }
    if (!card.spec_markdown?.trim()) throw new Error('No hay spec para continuar');

    await run(
        `UPDATE kickoff_cards SET gate_spec_status = 'approved', gate_spec_comment = NULL,
         current_step = 'wireframes_generating', gate_wireframes_status = 'pending',
         last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);

    const specMd = card.spec_markdown;

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const options = await generateWireframeOptionsFromSpec(specMd);
            if (options.length === 0) {
                throw new Error('El modelo no devolvió wireframes parseables; probá de nuevo o ajustá el prompt.');
            }
            await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [cardId]);
            for (const opt of options) {
                const wid = uuid();
                await run(
                    `INSERT INTO kickoff_wireframes (id, card_id, option_index, title, description, html_content, status, version)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
                    [wid, cardId, opt.optionIndex, opt.title, opt.description, opt.html]
                );
            }
            await run(
                `UPDATE kickoff_cards SET current_step = 'gate_wireframes', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`approveSpecGate wireframes failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'gate_spec', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
}

export async function rejectSpecGate(
    cardId: string,
    comment: string,
    workspaceId: string
): Promise<void> {
    if (!comment?.trim()) throw new Error('Comentario requerido');
    await run(
        `UPDATE kickoff_cards SET gate_spec_status = 'rejected', gate_spec_comment = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [comment.trim(), cardId, workspaceId]
    );
    await runSpecGeneration(cardId, workspaceId, comment.trim());
}

export async function approveWireframesGate(
    cardId: string,
    workspaceId: string,
    selectedOption?: 1 | 2 | 3,
    comment?: string
): Promise<void> {
    const card = await queryOne<{ current_step: string }>(
        `SELECT current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card) {
        throw new Error('Tarjeta no encontrada.');
    }
    // Doble clic o request duplicado: el primer approve ya pasó a hifi_generating.
    if (
        card.current_step === 'hifi_generating' ||
        card.current_step === 'gate_hifi' ||
        card.current_step === 'flowbite_generating' ||
        card.current_step === 'gate_flowbite' ||
        card.current_step === 'completed'
    ) {
        return;
    }
    if (card.current_step !== 'gate_wireframes') {
        throw new Error(
            `La tarjeta no está en revisión de wireframes (estado actual: ${card.current_step}). Actualizá la página.`
        );
    }

    const specRow = await queryOne<{ spec_markdown: string | null }>(
        `SELECT spec_markdown FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    const specMd = specRow?.spec_markdown?.trim() || '';
    if (!specMd) {
        throw new Error('No hay spec para generar wireframe en alta fidelidad.');
    }

    const wfRows = await queryAll<{
        option_index: number;
        title: string | null;
        description: string | null;
        html_content: string;
    }>(
        `SELECT option_index, title, description, html_content FROM kickoff_wireframes WHERE card_id = ? ORDER BY option_index`,
        [cardId]
    );
    if (wfRows.length === 0) {
        throw new Error('No hay wireframes de baja fidelidad para refinar.');
    }

    let lowRow: (typeof wfRows)[0] | undefined;
    if (wfRows.length === 1) {
        lowRow = wfRows[0];
        if (selectedOption != null && selectedOption !== lowRow.option_index) {
            throw new Error(`Esta tarjeta solo tiene la opción ${lowRow.option_index} de wireframe baja fidelidad.`);
        }
    } else {
        if (selectedOption == null) {
            throw new Error(
                'Elegí qué wireframe de baja fidelidad pasa a alta fidelidad (selected_option: 1, 2 o 3).'
            );
        }
        lowRow = wfRows.find((r) => r.option_index === selectedOption);
        if (!lowRow) {
            throw new Error('La opción seleccionada no coincide con ningún wireframe guardado.');
        }
    }

    const claim = await db.execute({
        sql: `UPDATE kickoff_cards SET gate_wireframes_status = 'approved',
         selected_wireframe_option = ?, gate_wireframes_comment = ?,
         current_step = 'hifi_generating', gate_stakeholder_status = 'pending',
         gate_stakeholder_comment = NULL, last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?${WS} AND current_step = 'gate_wireframes'`,
        args: [selectedOption ?? null, comment?.trim() || null, cardId, workspaceId],
    });

    if (claim.rowsAffected === 0) {
        const again = await queryOne<{ current_step: string }>(
            `SELECT current_step FROM kickoff_cards WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        if (
            again?.current_step === 'hifi_generating' ||
            again?.current_step === 'gate_hifi' ||
            again?.current_step === 'flowbite_generating' ||
            again?.current_step === 'gate_flowbite' ||
            again?.current_step === 'completed'
        ) {
            return;
        }
        throw new Error('No se pudo confirmar la aprobación. Actualizá la página e intentá de nuevo.');
    }

    await syncKanbanColumn(cardId, workspaceId);

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const low = {
                title: lowRow.title || '',
                description: lowRow.description || '',
                html: lowRow.html_content || '',
            };
            const options =
                config.HIFI_PROVIDER === 'aidesigner'
                    ? await generateHifiWireframeViaAIDesigner(specMd, low)
                    : await generateHifiWireframeFromSpecAndLowFi(specMd, low);
            if (options.length === 0) {
                throw new Error('El modelo no devolvió un wireframe alta fidelidad parseable.');
            }
            await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [cardId]);
            for (const opt of options) {
                const wid = uuid();
                await run(
                    `INSERT INTO kickoff_wireframes (id, card_id, option_index, title, description, html_content, status, version)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 2)`,
                    [wid, cardId, opt.optionIndex, opt.title, opt.description, opt.html]
                );
            }
            await run(
                `UPDATE kickoff_cards SET current_step = 'gate_hifi', gate_stakeholder_status = 'pending',
           last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`approveWireframesGate hifi failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'gate_wireframes', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
    await syncKanbanColumn(cardId, workspaceId);
}

export async function rejectWireframesGate(
    cardId: string,
    comment: string,
    workspaceId: string
): Promise<void> {
    if (!comment?.trim()) throw new Error('Comentario requerido');

    const card = await queryOne<{ spec_markdown: string | null; current_step: string }>(
        `SELECT spec_markdown, current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card || card.current_step !== 'gate_wireframes') {
        throw new Error('La tarjeta no está en revisión de wireframes');
    }
    if (!card.spec_markdown?.trim()) throw new Error('No hay spec');

    await run(
        `UPDATE kickoff_cards SET gate_wireframes_status = 'rejected', gate_wireframes_comment = ?,
         current_step = 'wireframes_generating', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [comment.trim(), cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);

    const specMd = card.spec_markdown;

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const options = await generateWireframeOptionsFromSpec(specMd, comment.trim());
            if (options.length === 0) {
                throw new Error('El modelo no devolvió wireframes parseables.');
            }
            await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [cardId]);
            for (const opt of options) {
                const wid = uuid();
                await run(
                    `INSERT INTO kickoff_wireframes (id, card_id, option_index, title, description, html_content, status, version)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
                    [wid, cardId, opt.optionIndex, opt.title, opt.description, opt.html]
                );
            }
            await run(
                `UPDATE kickoff_cards SET current_step = 'gate_wireframes', gate_wireframes_status = 'pending',
           last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`rejectWireframesGate failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'gate_wireframes', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
}

export async function approveStakeholderGate(cardId: string, workspaceId: string): Promise<void> {
    const card = await queryOne<{ current_step: string }>(
        `SELECT current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card) throw new Error('Tarjeta no encontrada.');
    if (
        card.current_step === 'flowbite_generating' ||
        card.current_step === 'gate_flowbite' ||
        card.current_step === 'completed'
    ) {
        return;
    }
    if (card.current_step !== 'gate_hifi') {
        throw new Error('La tarjeta no está en revisión de wireframe alta fidelidad');
    }

    const specRow = await queryOne<{ spec_markdown: string | null }>(
        `SELECT spec_markdown FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    const specMd = specRow?.spec_markdown?.trim() || '';
    if (!specMd) {
        throw new Error('No hay spec para generar Diseño Flowbite.');
    }

    const hifiRow = await queryOne<{
        title: string | null;
        description: string | null;
        html_content: string;
    }>(
        `SELECT title, description, html_content FROM kickoff_wireframes WHERE card_id = ? ORDER BY option_index LIMIT 1`,
        [cardId]
    );
    if (!hifiRow?.html_content?.trim()) {
        throw new Error('No hay wireframe de alta fidelidad guardado.');
    }

    const claim = await db.execute({
        sql: `UPDATE kickoff_cards SET gate_stakeholder_status = 'approved',
         current_step = 'flowbite_generating', gate_flowbite_status = 'pending',
         gate_flowbite_comment = NULL, flowbite_html = NULL, flowbite_metadata = NULL,
         last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?${WS} AND current_step = 'gate_hifi'`,
        args: [cardId, workspaceId],
    });

    if (claim.rowsAffected === 0) {
        const again = await queryOne<{ current_step: string }>(
            `SELECT current_step FROM kickoff_cards WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        if (
            again?.current_step === 'flowbite_generating' ||
            again?.current_step === 'gate_flowbite' ||
            again?.current_step === 'completed'
        ) {
            return;
        }
        throw new Error('No se pudo confirmar la aprobación. Actualizá la página e intentá de nuevo.');
    }

    await syncKanbanColumn(cardId, workspaceId);

    const hifi = {
        title: hifiRow.title || '',
        description: hifiRow.description || '',
        html: hifiRow.html_content || '',
    };

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const options = await generateFlowbiteDesignFromHifi(specMd, hifi);
            const opt = options[0];
            const html = opt?.html?.trim();
            if (!html) {
                throw new Error('El modelo no devolvió HTML parseable para Diseño Flowbite.');
            }
            const meta = serializeFlowbiteMetadata({
                title: opt?.title || '',
                description: opt?.description || '',
                components: opt?.components || '',
            });
            await run(
                `UPDATE kickoff_cards SET flowbite_html = ?, flowbite_metadata = ?, current_step = 'gate_flowbite',
           gate_flowbite_status = 'pending', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?${WS}`,
                [html, meta, cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`approveStakeholderGate flowbite failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'gate_hifi', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
    await syncKanbanColumn(cardId, workspaceId);
}

export async function approveFlowbiteGate(cardId: string, workspaceId: string): Promise<void> {
    const card = await queryOne<{ current_step: string }>(
        `SELECT current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card) throw new Error('Tarjeta no encontrada.');
    if (card.current_step === 'completed') return;
    if (card.current_step !== 'gate_flowbite') {
        throw new Error('La tarjeta no está en revisión de Diseño Flowbite');
    }

    await run(
        `UPDATE kickoff_cards SET gate_flowbite_status = 'approved', current_step = 'completed',
         last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);
}

export async function rejectFlowbiteGate(cardId: string, comment: string, workspaceId: string): Promise<void> {
    if (!comment?.trim()) throw new Error('Comentario requerido');

    const card = await queryOne<{ spec_markdown: string | null; current_step: string }>(
        `SELECT spec_markdown, current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card || card.current_step !== 'gate_flowbite') {
        throw new Error('La tarjeta no está en revisión de Diseño Flowbite');
    }
    if (!card.spec_markdown?.trim()) throw new Error('No hay spec');

    const hifiRow = await queryOne<{
        title: string | null;
        description: string | null;
        html_content: string;
    }>(
        `SELECT title, description, html_content FROM kickoff_wireframes WHERE card_id = ? ORDER BY option_index LIMIT 1`,
        [cardId]
    );
    if (!hifiRow?.html_content?.trim()) {
        throw new Error('No hay wireframe de alta fidelidad para reintentar Diseño Flowbite.');
    }

    await run(
        `UPDATE kickoff_cards SET gate_flowbite_status = 'rejected', gate_flowbite_comment = ?,
         current_step = 'flowbite_generating', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [comment.trim(), cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);

    const specMd = card.spec_markdown;
    const hifi = {
        title: hifiRow.title || '',
        description: hifiRow.description || '',
        html: hifiRow.html_content || '',
    };

    try {
        await runWithGeneratingFlag(cardId, workspaceId, async () => {
            const options = await generateFlowbiteDesignFromHifi(specMd, hifi, comment.trim());
            const opt = options[0];
            const html = opt?.html?.trim();
            if (!html) {
                throw new Error('El modelo no devolvió HTML parseable para Diseño Flowbite.');
            }
            const meta = serializeFlowbiteMetadata({
                title: opt?.title || '',
                description: opt?.description || '',
                components: opt?.components || '',
            });
            await run(
                `UPDATE kickoff_cards SET flowbite_html = ?, flowbite_metadata = ?, current_step = 'gate_flowbite',
           gate_flowbite_status = 'pending', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?${WS}`,
                [html, meta, cardId, workspaceId]
            );
        });
    } catch (err) {
        console.error(`rejectFlowbiteGate failed ${cardId}:`, err);
        const msg = formatGenerationError(err);
        await run(
            `UPDATE kickoff_cards SET current_step = 'gate_flowbite', is_generating = 0,
           last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [msg, cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);
        throw err;
    }
    await syncKanbanColumn(cardId, workspaceId);
}

export async function rejectStakeholderGate(
    cardId: string,
    comment: string,
    restartFrom: 'spec' | 'wireframes',
    workspaceId: string
): Promise<void> {
    if (!comment?.trim()) throw new Error('Comentario requerido');

    const card = await queryOne<{ spec_markdown: string | null; current_step: string }>(
        `SELECT spec_markdown, current_step FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card || card.current_step !== 'gate_hifi') {
        throw new Error('La tarjeta no está en revisión de wireframe alta fidelidad');
    }

    await run(
        `UPDATE kickoff_cards SET gate_stakeholder_status = 'rejected', gate_stakeholder_comment = ?,
         restart_from = ?, flowbite_html = NULL, flowbite_metadata = NULL, gate_flowbite_status = 'pending',
         gate_flowbite_comment = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [comment.trim(), restartFrom, cardId, workspaceId]
    );

    if (restartFrom === 'spec') {
        await run(
            `UPDATE kickoff_cards SET current_step = 'spec_generating', gate_spec_status = 'pending',
           gate_wireframes_status = 'pending', gate_stakeholder_status = 'pending',
           selected_wireframe_option = NULL, flowbite_html = NULL, flowbite_metadata = NULL, gate_flowbite_status = 'pending',
           gate_flowbite_comment = NULL, last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);

        const full = await queryOne<{ transcript: string }>(
            `SELECT transcript FROM kickoff_cards WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        if (!full?.transcript) throw new Error('Sin transcripción');

        try {
            await runWithGeneratingFlag(cardId, workspaceId, async () => {
                const spec = await generateSpecFromTranscript(full.transcript, comment.trim());
                await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [cardId]);
                await run(
                    `UPDATE kickoff_cards SET spec_markdown = ?, current_step = 'gate_spec',
               gate_spec_status = 'pending', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                    [spec, cardId, workspaceId]
                );
            });
        } catch (err) {
            console.error(`rejectStakeholderGate spec branch failed ${cardId}:`, err);
            const msg = formatGenerationError(err);
            await run(
                `UPDATE kickoff_cards SET current_step = 'gate_hifi', is_generating = 0,
               last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [msg, cardId, workspaceId]
            );
            await syncKanbanColumn(cardId, workspaceId);
            throw err;
        }
    } else {
        await run(
            `UPDATE kickoff_cards SET current_step = 'wireframes_generating', gate_wireframes_status = 'pending',
           gate_stakeholder_status = 'pending', flowbite_html = NULL, flowbite_metadata = NULL, gate_flowbite_status = 'pending',
           gate_flowbite_comment = NULL, last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
            [cardId, workspaceId]
        );
        await syncKanbanColumn(cardId, workspaceId);

        if (!card.spec_markdown?.trim()) throw new Error('No hay spec');
        const specMd = card.spec_markdown;

        try {
            await runWithGeneratingFlag(cardId, workspaceId, async () => {
                const options = await generateWireframeOptionsFromSpec(specMd, comment.trim());
                if (options.length === 0) {
                    throw new Error('El modelo no devolvió wireframes parseables.');
                }
                await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [cardId]);
                for (const opt of options) {
                    const wid = uuid();
                    await run(
                        `INSERT INTO kickoff_wireframes (id, card_id, option_index, title, description, html_content, status, version)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
                        [wid, cardId, opt.optionIndex, opt.title, opt.description, opt.html]
                    );
                }
                await run(
                    `UPDATE kickoff_cards SET current_step = 'gate_wireframes', last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                    [cardId, workspaceId]
                );
            });
        } catch (err) {
            console.error(`rejectStakeholderGate wireframes branch failed ${cardId}:`, err);
            const msg = formatGenerationError(err);
            await run(
                `UPDATE kickoff_cards SET current_step = 'gate_hifi', is_generating = 0,
               last_generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
                [msg, cardId, workspaceId]
            );
            await syncKanbanColumn(cardId, workspaceId);
            throw err;
        }
    }
}

export async function patchKanbanColumn(
    cardId: string,
    column: 'todo' | 'wip',
    workspaceId: string
): Promise<void> {
    const card = await queryOne<{ current_step: string; is_generating: number }>(
        `SELECT current_step, is_generating FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!card) throw new Error('Card not found');
    if (Number(card.is_generating) === 1) {
        throw new Error('No se puede mover mientras genera');
    }
    if (card.current_step !== 'transcript') {
        throw new Error('Solo se puede reordenar en To Do / WIP antes de generar el spec');
    }

    await run(
        `UPDATE kickoff_cards SET kanban_column = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [column, cardId, workspaceId]
    );
    await syncWorkItemsFromCardState(cardId, workspaceId);
}

export async function duplicateCard(sourceId: string, workspaceId: string): Promise<string> {
    const src = await queryOne<{
        title: string;
        transcript: string;
    }>(`SELECT title, transcript FROM kickoff_cards WHERE id = ?${WS}`, [sourceId, workspaceId]);
    if (!src) throw new Error('Card not found');

    const newId = uuid();
    const base = String(src.title || 'Sin título').trim() || 'Sin título';
    const suffix = ' (copia)';
    const title =
        base.length + suffix.length > 500
            ? `${base.slice(0, 500 - suffix.length - 1)}…${suffix}`
            : `${base}${suffix}`;

    await run(
        `INSERT INTO kickoff_cards (
      id, title, transcript, kanban_column, current_step,
      spec_markdown, gate_spec_status, gate_spec_comment,
      gate_wireframes_status, gate_wireframes_comment,
      selected_wireframe_option, gate_stakeholder_status,
      gate_stakeholder_comment, flowbite_html, flowbite_metadata, gate_flowbite_status,
      gate_flowbite_comment, restart_from, is_generating, workspace_id
    ) VALUES (?, ?, ?, 'todo', 'transcript',
      NULL, 'pending', NULL, 'pending', NULL, NULL, 'pending', NULL, NULL, NULL, 'pending', NULL, NULL, 0, ?)`,
        [newId, title, String(src.transcript || ''), workspaceId]
    );
    await syncKanbanColumn(newId, workspaceId);
    return newId;
}

export async function clearLastGenerationError(cardId: string, workspaceId: string): Promise<void> {
    const c = await queryOne<{ id: string }>(
        `SELECT id FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!c) throw new Error('Card not found');
    await run(
        `UPDATE kickoff_cards SET last_generation_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
}

export async function unlockStuckGeneration(cardId: string, workspaceId: string): Promise<void> {
    const c = await queryOne<{
        current_step: string;
        spec_markdown: string | null;
        is_generating: number;
    }>(
        `SELECT current_step, spec_markdown, is_generating FROM kickoff_cards WHERE id = ?${WS}`,
        [cardId, workspaceId]
    );
    if (!c) throw new Error('Card not found');
    if (Number(c.is_generating) !== 1) {
        throw new Error('No hay generación en curso para desbloquear');
    }

    const step = c.current_step as FlowStep;
    let nextStep: FlowStep;

    if (step === 'spec_generating') {
        nextStep = 'transcript';
    } else if (step === 'wireframes_generating') {
        nextStep = String(c.spec_markdown || '').trim() ? 'gate_spec' : 'transcript';
    } else if (step === 'hifi_generating') {
        nextStep = 'gate_wireframes';
    } else if (step === 'flowbite_generating') {
        nextStep = 'gate_hifi';
    } else {
        throw new Error(
            'Desbloqueo solo aplica durante generación de spec, wireframes, alta fidelidad o Diseño Flowbite'
        );
    }

    await run(
        `UPDATE kickoff_cards SET is_generating = 0, current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?${WS}`,
        [nextStep, cardId, workspaceId]
    );
    await syncKanbanColumn(cardId, workspaceId);
}
