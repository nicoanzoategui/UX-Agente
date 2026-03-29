// backend/src/routes/review.routes.ts

import { Router } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { handleApproval, handleRejection } from '../services/agent.service.js';

const router = Router();

// GET /api/review/pending - Revisiones pendientes
router.get('/pending', async (req, res) => {
    try {
        const pending = await queryAll<any>(`
      SELECT 
        do.*,
        us.jira_key,
        us.title as story_title
      FROM design_outputs do
      JOIN user_stories us ON do.story_id = us.id
      WHERE do.status = 'pending'
      ORDER BY do.created_at DESC
    `);
        res.json(pending);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/review/:outputId/approve
router.post('/:outputId/approve', async (req, res) => {
    try {
        const output = await queryOne<any>(
            'SELECT * FROM design_outputs WHERE id = ?',
            [req.params.outputId]
        );

        if (!output) {
            return res.status(404).json({ error: 'Output not found' });
        }

        await handleApproval(output.story_id, req.params.outputId);
        res.json({ success: true, message: 'Approved' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/review/:outputId/reject
router.post('/:outputId/reject', async (req, res) => {
    try {
        const { feedback } = req.body;

        if (!feedback?.trim()) {
            return res.status(400).json({ error: 'Feedback is required' });
        }

        const output = await queryOne<any>(
            'SELECT * FROM design_outputs WHERE id = ?',
            [req.params.outputId]
        );

        if (!output) {
            return res.status(404).json({ error: 'Output not found' });
        }

        await handleRejection(output.story_id, req.params.outputId, feedback);
        res.json({ success: true, message: 'Feedback sent' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
