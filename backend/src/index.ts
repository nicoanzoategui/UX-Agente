// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDatabase } from './db/database.js';
import storiesRoutes from './routes/stories.routes.js';
import reviewRoutes from './routes/review.routes.js';
import { startPolling } from './services/jira.service.js';

const app = express();

app.use(cors({ origin: config.FRONTEND_URL }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/stories', storiesRoutes);
app.use('/api/review', reviewRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
    try {
        await initDatabase();

        // Start Jira polling every 2 minutes (120000ms)
        startPolling(120000);

        app.listen(config.PORT, () => {
            console.log(`✓ Design Agent running on port ${config.PORT}`);
        });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

start();
