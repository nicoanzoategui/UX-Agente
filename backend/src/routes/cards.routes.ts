import { Router, type Request } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { getAuth, requireAuth } from '../middleware/require-auth.js';
import { transcriptFileUpload } from '../middleware/transcript-upload.js';
import {
    listWorkItemsForCard,
    listWorkItemsForWorkspace,
    syncWorkItemsFromCardState,
    WORK_ITEM_KINDS,
} from '../services/work-items.service.js';
import {
    approveFlowbiteGate,
    approveSpecGate,
    approveStakeholderGate,
    approveWireframesGate,
    clearLastGenerationError,
    duplicateCard,
    patchKanbanColumn,
    rejectFlowbiteGate,
    rejectSpecGate,
    rejectStakeholderGate,
    rejectWireframesGate,
    runSpecGeneration,
    syncKanbanColumn,
    unlockStuckGeneration,
} from '../services/workflow.service.js';

const router = Router();
router.use(requireAuth);

function wid(req: Request): string {
    return getAuth(req).workspaceId;
}

function exportAttachmentFilename(title: string | null | undefined, id: string): string {
    const raw = String(title || 'tarjeta')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    const base = raw || 'tarjeta';
    return `framework-ux-${base}-${id.slice(0, 8)}.json`;
}

router.post(
    '/upload',
    (req, res, next) => {
        transcriptFileUpload.single('transcript_file')(req, res, (err: unknown) => {
            if (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Archivo demasiado grande (máx 20 MB)' });
                }
                return res.status(400).json({ error: msg || 'Archivo no válido' });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            const w = wid(req);
            const title = String(req.body?.title || '').trim();
            if (!title) {
                return res.status(400).json({ error: 'title es requerido' });
            }
            let transcript = String(req.body?.transcript || '').trim();
            if (req.file?.buffer?.length) {
                transcript = req.file.buffer.toString('utf-8').trim();
            }
            if (!transcript) {
                return res.status(400).json({
                    error: 'Hace falta transcripción: pegá texto en el campo o subí un archivo al crear la tarjeta.',
                });
            }
            const id = uuid();
            await run(
                `INSERT INTO kickoff_cards (id, title, transcript, kanban_column, current_step, workspace_id)
       VALUES (?, ?, ?, 'todo', 'transcript', ?)`,
                [id, title, transcript, w]
            );
            await syncKanbanColumn(id, w);
            const card = await queryOne<any>('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
                id,
                w,
            ]);
            if (!card) {
                return res.status(500).json({ error: 'No se pudo cargar la tarjeta recién creada' });
            }
            const work_items = await listWorkItemsForCard(id, w);
            void runSpecGeneration(id, w).catch((err) =>
                console.error(`runSpecGeneration tras crear tarjeta ${id}:`, err)
            );
            res.status(201).json({ ...card, work_items });
        } catch (e: any) {
            res.status(500).json({ error: e.message || 'Error al crear tarjeta' });
        }
    }
);

router.post('/', async (req, res) => {
    try {
        const w = wid(req);
        const { title, transcript } = req.body as { title?: string; transcript?: string };
        if (!title?.trim()) {
            return res.status(400).json({ error: 'title es requerido' });
        }
        const text = (transcript || '').trim();
        if (!text) {
            return res.status(400).json({
                error: 'Hace falta la transcripción (texto) para crear la tarjeta.',
            });
        }
        const id = uuid();
        await run(
            `INSERT INTO kickoff_cards (id, title, transcript, kanban_column, current_step, workspace_id)
       VALUES (?, ?, ?, 'todo', 'transcript', ?)`,
            [id, title.trim(), text, w]
        );
        await syncKanbanColumn(id, w);
        const card = await queryOne<any>('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            id,
            w,
        ]);
        if (!card) {
            return res.status(500).json({ error: 'No se pudo cargar la tarjeta recién creada' });
        }
        const work_items = await listWorkItemsForCard(id, w);
        void runSpecGeneration(id, w).catch((err) =>
            console.error(`runSpecGeneration tras crear tarjeta ${id}:`, err)
        );
        res.status(201).json({ ...card, work_items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const w = wid(req);
        const cards = await queryAll<any>(
            `SELECT * FROM kickoff_cards WHERE workspace_id = ? ORDER BY updated_at DESC`,
            [w]
        );
        const items = await listWorkItemsForWorkspace(w);
        const byCard = new Map<string, typeof items>();
        for (const it of items) {
            const arr = byCard.get(it.card_id);
            if (arr) arr.push(it);
            else byCard.set(it.card_id, [it]);
        }
        const enriched: any[] = [];
        for (const c of cards) {
            let work_items = byCard.get(c.id) ?? [];
            if (work_items.length < WORK_ITEM_KINDS.length) {
                await syncWorkItemsFromCardState(c.id, w);
                work_items = await listWorkItemsForCard(c.id, w);
            }
            enriched.push({ ...c, work_items });
        }
        res.json(enriched);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/:id/export', async (req, res) => {
    try {
        const w = wid(req);
        const card = await queryOne<any>('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        if (!card) return res.status(404).json({ error: 'Card not found' });

        const wireframes = await queryAll<any>(
            `SELECT * FROM kickoff_wireframes WHERE card_id = ? ORDER BY option_index`,
            [req.params.id]
        );
        let work_items = await listWorkItemsForCard(req.params.id, w);
        if (work_items.length < WORK_ITEM_KINDS.length) {
            await syncWorkItemsFromCardState(req.params.id, w);
            work_items = await listWorkItemsForCard(req.params.id, w);
        }
        const payload = { ...card, wireframes, work_items, exported_at: new Date().toISOString() };
        const fname = exportAttachmentFilename(card.title, req.params.id);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(JSON.stringify(payload, null, 2));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const w = wid(req);
        const card = await queryOne<any>('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        if (!card) return res.status(404).json({ error: 'Card not found' });

        const wireframes = await queryAll<any>(
            `SELECT * FROM kickoff_wireframes WHERE card_id = ? ORDER BY option_index`,
            [req.params.id]
        );
        let work_items = await listWorkItemsForCard(req.params.id, w);
        if (work_items.length < WORK_ITEM_KINDS.length) {
            await syncWorkItemsFromCardState(req.params.id, w);
            work_items = await listWorkItemsForCard(req.params.id, w);
        }
        res.json({ ...card, wireframes, work_items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/column', async (req, res) => {
    try {
        const w = wid(req);
        const { column } = req.body as { column?: string };
        if (column !== 'todo' && column !== 'wip') {
            return res.status(400).json({ error: 'column debe ser todo o wip' });
        }
        await patchKanbanColumn(req.params.id, column, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.patch(
    '/:id/transcript/file',
    (req, res, next) => {
        transcriptFileUpload.single('transcript_file')(req, res, (err: unknown) => {
            if (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Archivo demasiado grande (máx 20 MB)' });
                }
                return res.status(400).json({ error: msg || 'Archivo no válido' });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            const w = wid(req);
            if (!req.file?.buffer?.length) {
                return res.status(400).json({ error: 'Archivo transcript_file requerido' });
            }
            const card = await queryOne<{ current_step: string }>(
                'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
                [req.params.id, w]
            );
            if (!card) return res.status(404).json({ error: 'Card not found' });
            if (card.current_step !== 'transcript') {
                return res.status(400).json({ error: 'Solo se edita la transcripción antes de generar el spec' });
            }
            const text = req.file.buffer.toString('utf-8');
            await run(
                `UPDATE kickoff_cards SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`,
                [text, req.params.id, w]
            );
            const updated = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
                req.params.id,
                w,
            ]);
            res.json(updated);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
);

router.patch('/:id/transcript', async (req, res) => {
    try {
        const w = wid(req);
        const { transcript } = req.body as { transcript?: string };
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'transcript') {
            return res.status(400).json({ error: 'Solo se edita la transcripción antes de generar el spec' });
        }
        await run(
            `UPDATE kickoff_cards SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`,
            [(transcript || '').trim(), req.params.id, w]
        );
        const updated = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/spec', async (req, res) => {
    try {
        const w = wid(req);
        const { spec_markdown } = req.body as { spec_markdown?: string };
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_spec') {
            return res.status(400).json({ error: 'Solo se edita el spec durante la revisión (Gate 1)' });
        }
        const body = spec_markdown ?? '';
        if (!body.trim()) {
            return res.status(400).json({ error: 'El spec no puede quedar vacío' });
        }
        await run(
            `UPDATE kickoff_cards SET spec_markdown = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`,
            [body, req.params.id, w]
        );
        const updated = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/duplicate', async (req, res) => {
    try {
        const w = wid(req);
        const newId = await duplicateCard(req.params.id, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            newId,
            w,
        ]);
        res.status(201).json(card);
    } catch (e: any) {
        const msg = e.message || 'Error al duplicar';
        const code = msg === 'Card not found' ? 404 : 400;
        res.status(code).json({ error: msg });
    }
});

router.post('/:id/unlock-generation', async (req, res) => {
    try {
        const w = wid(req);
        await unlockStuckGeneration(req.params.id, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        const msg = e.message || 'Error';
        const code = msg === 'Card not found' ? 404 : 400;
        res.status(code).json({ error: msg });
    }
});

router.post('/:id/clear-generation-error', async (req, res) => {
    try {
        const w = wid(req);
        await clearLastGenerationError(req.params.id, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        const msg = e.message || 'Error';
        const code = msg === 'Card not found' ? 404 : 400;
        res.status(code).json({ error: msg });
    }
});

router.post('/:id/run-spec', async (req, res) => {
    try {
        const w = wid(req);
        const card = await queryOne<{ current_step: string; transcript: string }>(
            'SELECT current_step, transcript FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step === 'spec_generating') {
            return res.status(400).json({ error: 'Ya se está generando el spec' });
        }
        if (card.current_step !== 'transcript') {
            return res.status(400).json({ error: 'Solo se genera el spec desde el paso inicial (transcripción)' });
        }
        if (!card.transcript?.trim()) {
            return res.status(400).json({ error: 'Agregá una transcripción antes de generar el spec' });
        }

        void runSpecGeneration(req.params.id, w).catch((err) =>
            console.error(`runSpecGeneration ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Generación de spec iniciada' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-spec/approve', async (req, res) => {
    try {
        const w = wid(req);
        const card = await queryOne<{ current_step: string; spec_markdown: string | null }>(
            'SELECT current_step, spec_markdown FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_spec') {
            return res.status(400).json({ error: 'La tarjeta no está en revisión de spec' });
        }
        if (!String(card.spec_markdown || '').trim()) {
            return res.status(400).json({ error: 'No hay spec para aprobar' });
        }

        void approveSpecGate(req.params.id, w).catch((err) =>
            console.error(`approveSpecGate ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Aprobado; generando wireframes' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-spec/reject', async (req, res) => {
    try {
        const w = wid(req);
        const { comment } = req.body as { comment?: string };
        if (!comment?.trim()) return res.status(400).json({ error: 'comment requerido' });
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_spec') {
            return res.status(400).json({ error: 'La tarjeta no está en revisión de spec' });
        }

        void rejectSpecGate(req.params.id, comment, w).catch((err) =>
            console.error(`rejectSpecGate ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Regenerando spec con tu feedback' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-wireframes/approve', async (req, res) => {
    try {
        const w = wid(req);
        const { selected_option, comment } = req.body as {
            selected_option?: number;
            comment?: string;
        };
        const opt =
            selected_option === 1 || selected_option === 2 || selected_option === 3
                ? selected_option
                : undefined;

        const wfCountRow = await queryOne<{ n: number }>(
            'SELECT COUNT(*) as n FROM kickoff_wireframes WHERE card_id = ?',
            [req.params.id]
        );
        const n = Number(wfCountRow?.n ?? 0);
        if (n >= 2 && opt === undefined) {
            return res.status(400).json({
                error: 'Elegí la opción ganadora con selected_option: 1, 2 o 3 (wireframe baja fidelidad que pasa a alta).',
            });
        }

        await approveWireframesGate(req.params.id, w, opt, comment);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-wireframes/reject', async (req, res) => {
    try {
        const w = wid(req);
        const { comment } = req.body as { comment?: string };
        if (!comment?.trim()) return res.status(400).json({ error: 'comment requerido' });
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_wireframes') {
            return res.status(400).json({ error: 'La tarjeta no está en revisión de wireframes' });
        }

        void rejectWireframesGate(req.params.id, comment, w).catch((err) =>
            console.error(`rejectWireframesGate ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Regenerando wireframes' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-stakeholder/approve', async (req, res) => {
    try {
        const w = wid(req);
        await approveStakeholderGate(req.params.id, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-flowbite/approve', async (req, res) => {
    try {
        const w = wid(req);
        await approveFlowbiteGate(req.params.id, w);
        const card = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(card);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-flowbite/reject', async (req, res) => {
    try {
        const w = wid(req);
        const { comment } = req.body as { comment?: string };
        if (!comment?.trim()) return res.status(400).json({ error: 'comment requerido' });
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_flowbite') {
            return res.status(400).json({ error: 'La tarjeta no está en revisión de Diseño Flowbite' });
        }

        void rejectFlowbiteGate(req.params.id, comment, w).catch((err) =>
            console.error(`rejectFlowbiteGate ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Regenerando Diseño Flowbite' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/gate-stakeholder/reject', async (req, res) => {
    try {
        const w = wid(req);
        const { comment, restart_from } = req.body as {
            comment?: string;
            restart_from?: string;
        };
        if (!comment?.trim()) return res.status(400).json({ error: 'comment requerido' });
        const card = await queryOne<{ current_step: string }>(
            'SELECT current_step FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.current_step !== 'gate_hifi') {
            return res.status(400).json({ error: 'La tarjeta no está en revisión de wireframe alta fidelidad' });
        }

        const rf = restart_from === 'wireframes' ? 'wireframes' : 'spec';
        void rejectStakeholderGate(req.params.id, comment, rf, w).catch((err) =>
            console.error(`rejectStakeholderGate ${req.params.id}:`, err)
        );
        res.json({ success: true, message: 'Reinicio solicitado' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const w = wid(req);
        const card = await queryOne<{ is_generating: number }>(
            'SELECT is_generating FROM kickoff_cards WHERE id = ? AND workspace_id = ?',
            [req.params.id, w]
        );
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (Number(card.is_generating) === 1) {
            return res.status(400).json({ error: 'Esperá a que termine la generación antes de eliminar' });
        }
        await run('DELETE FROM kickoff_work_items WHERE card_id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        await run('DELETE FROM kickoff_wireframes WHERE card_id = ?', [req.params.id]);
        await run('DELETE FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [req.params.id, w]);
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const w = wid(req);
        const { title } = req.body as { title?: string };
        if (!title?.trim()) {
            return res.status(400).json({ error: 'title es requerido' });
        }
        const existing = await queryOne('SELECT id FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        if (!existing) return res.status(404).json({ error: 'Card not found' });
        await run(
            `UPDATE kickoff_cards SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`,
            [title.trim(), req.params.id, w]
        );
        const updated = await queryOne('SELECT * FROM kickoff_cards WHERE id = ? AND workspace_id = ?', [
            req.params.id,
            w,
        ]);
        res.json(updated);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
