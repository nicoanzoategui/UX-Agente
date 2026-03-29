// backend/src/routes/stories.routes.ts

import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/database.js';
import { generateAndUpload, runWithGeneratingFlag } from '../services/agent.service.js';
import {
    ensureJiraIssueExistsOrRemoveLocal,
    reconcileUserStoriesWithJira,
} from '../services/jira.service.js';

const router = Router();

let lastStoriesReconcileMs = 0;
const STORIES_RECONCILE_MIN_INTERVAL_MS = 45_000;

/** Reintenta solo el wireframe inicial (nivel 1) si Gemini falló y no hay filas en design_outputs. */
router.post('/:storyId/retry-first-design', async (req, res) => {
    try {
        const story = await queryOne<any>('SELECT * FROM user_stories WHERE id = ?', [req.params.storyId]);
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }
        const row = await queryOne<{ c: number }>(
            'SELECT COUNT(*) as c FROM design_outputs WHERE story_id = ?',
            [story.id]
        );
        if ((row?.c ?? 0) > 0) {
            return res.status(400).json({
                error: 'Ya hay diseños generados. Usá aprobar / feedback en la pantalla de revisión.',
            });
        }
        await run(`UPDATE user_stories SET is_generating = 0 WHERE id = ?`, [story.id]);
        await runWithGeneratingFlag(story.id, () => generateAndUpload(story.id, 1));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stories - Listar todas
router.get('/', async (req, res) => {
    try {
        const now = Date.now();
        if (now - lastStoriesReconcileMs >= STORIES_RECONCILE_MIN_INTERVAL_MS) {
            lastStoriesReconcileMs = now;
            try {
                await reconcileUserStoriesWithJira();
            } catch (e) {
                console.warn('reconcileUserStoriesWithJira:', e);
            }
        }

        const stories = await queryAll<any>(`
      SELECT 
        us.*,
        (SELECT COUNT(*) FROM design_outputs WHERE story_id = us.id) as outputs_count,
        (SELECT COUNT(*) FROM design_outputs WHERE story_id = us.id AND status = 'approved') as approved_count
      FROM user_stories us
      ORDER BY us.created_at DESC
    `);
        res.json(stories);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stories/:id - Detalle con outputs
router.get('/:id', async (req, res) => {
    try {
        const story = await queryOne<any>(
            'SELECT * FROM user_stories WHERE id = ?',
            [req.params.id]
        );

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const stillThere = await ensureJiraIssueExistsOrRemoveLocal(story.id, story.jira_key);
        if (!stillThere) {
            return res.status(404).json({
                error: 'Story not found',
                reason: 'removed_from_jira',
            });
        }

        const outputs = await queryAll<any>(
            `SELECT * FROM design_outputs 
       WHERE story_id = ? 
       ORDER BY level, version DESC`,
            [req.params.id]
        );

        res.json({ ...story, outputs });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
