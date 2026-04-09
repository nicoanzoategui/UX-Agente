import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { assertProductionAuthConfig, config, corsAllowedOrigins } from './config/env.js';
import { initDatabase, queryOne } from './db/database.js';
import { apiRateLimit } from './middleware/api-rate-limit.js';
import agentRoutes from './routes/agent.routes.js';
import authRoutes from './routes/auth.routes.js';
import cardsRoutes from './routes/cards.routes.js';

assertProductionAuthConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');
const SERVICE_VERSION =
    (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }).version ?? '0.0.0';

const app = express();

/** Railway (y otros reverse proxy) terminan TLS; sin esto `req.ip` y rate limit pueden fallar. */
const trustProxy =
    config.TRUST_PROXY || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME);
if (trustProxy) {
    app.set('trust proxy', 1);
}

const allowedOrigins = corsAllowedOrigins();
app.use(
    cors({
        origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
        credentials: true,
        exposedHeaders: [
            'Content-Disposition',
            'Retry-After',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ],
    })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRateLimit);

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api', agentRoutes);

app.get('/health', async (_req, res) => {
    const timestamp = new Date().toISOString();
    const base = {
        service: 'framework-ux-backend',
        version: SERVICE_VERSION,
        timestamp,
    };
    try {
        await queryOne('SELECT 1 as ok');
        res.json({ status: 'ok', database: 'ok', ...base });
    } catch {
        res.status(503).json({ status: 'degraded', database: 'error', ...base });
    }
});

async function start() {
    try {
        await initDatabase();

        const server = app.listen(config.PORT, () => {
            console.log(`✓ Framework UX backend on port ${config.PORT}`);
        });

        const shutdown = (signal: string) => {
            console.log(`\n${signal} recibido, cerrando servidor…`);
            server.close(() => {
                console.log('Servidor HTTP cerrado');
                process.exit(0);
            });
            setTimeout(() => {
                console.error('Timeout al cerrar; saliendo');
                process.exit(1);
            }, 10_000).unref();
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

start();
