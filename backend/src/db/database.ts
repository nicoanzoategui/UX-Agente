import { createClient } from '@libsql/client';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { TEAM_WORKSPACE_ID } from '../constants/team.js';

const __dbDir = dirname(fileURLToPath(import.meta.url));
/** Siempre bajo `backend/local.db` aunque el proceso no se ejecute desde esa carpeta. */
const LOCAL_SQLITE_URL = `file:${join(__dbDir, '..', '..', 'local.db')}`;

const dbUrl = (config.TURSO_DATABASE_URL || '').trim() || LOCAL_SQLITE_URL;

export const db = createClient({
    url: dbUrl,
    authToken: config.TURSO_AUTH_TOKEN?.trim() || undefined,
});

export async function initDatabase() {
    await db.execute(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      picture TEXT,
      google_sub TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS kickoff_cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      transcript TEXT NOT NULL DEFAULT '',
      spec_markdown TEXT,
      kanban_column TEXT NOT NULL DEFAULT 'todo',
      current_step TEXT NOT NULL DEFAULT 'transcript',
      gate_spec_status TEXT NOT NULL DEFAULT 'pending',
      gate_spec_comment TEXT,
      gate_wireframes_status TEXT NOT NULL DEFAULT 'pending',
      gate_wireframes_comment TEXT,
      selected_wireframe_option INTEGER,
      gate_stakeholder_status TEXT NOT NULL DEFAULT 'pending',
      gate_stakeholder_comment TEXT,
      restart_from TEXT,
      is_generating INTEGER NOT NULL DEFAULT 0,
      last_generation_error TEXT,
      workspace_id TEXT NOT NULL DEFAULT '${TEAM_WORKSPACE_ID}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    )
  `);

    await ensureKickoffCardColumns();
    await ensureWorkspaceBootstrap();
    await migrateFlowStepStakeholderToHifi();

    await db.execute(`
    CREATE TABLE IF NOT EXISTS kickoff_work_items (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      kanban_column TEXT NOT NULL,
      is_generating INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES kickoff_cards(id),
      UNIQUE(card_id, kind)
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS figma_build_jobs (
      id TEXT PRIMARY KEY,
      fetch_secret TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS kickoff_wireframes (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      html_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      feedback TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES kickoff_cards(id),
      UNIQUE(card_id, option_index)
    )
  `);

    try {
        const { backfillWorkItemsAllCards } = await import('../services/work-items.service.js');
        await backfillWorkItemsAllCards();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('kickoff_work_items backfill:', msg);
    }

    console.log('✓ Database initialized (Framework UX)');
}

/** Tarjetas en el gate antiguo pasan al nuevo paso de wireframe alta fidelidad. */
async function migrateFlowStepStakeholderToHifi() {
    try {
        await db.execute({
            sql: `UPDATE kickoff_cards SET current_step = 'gate_hifi' WHERE current_step = 'gate_stakeholder'`,
            args: [],
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('migrateFlowStepStakeholderToHifi:', msg);
    }
}

async function ensureWorkspaceBootstrap() {
    await db.execute({
        sql: `INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)`,
        args: [TEAM_WORKSPACE_ID, 'Equipo product design'],
    });
}

/** Migraciones ligeras para bases ya creadas antes de nuevas columnas / tablas */
async function ensureKickoffCardColumns() {
    const alters = [
        `ALTER TABLE kickoff_cards ADD COLUMN last_generation_error TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${TEAM_WORKSPACE_ID}'`,
        `ALTER TABLE kickoff_cards ADD COLUMN flowbite_html TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN gate_flowbite_status TEXT NOT NULL DEFAULT 'pending'`,
        `ALTER TABLE kickoff_cards ADD COLUMN gate_flowbite_comment TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN flowbite_metadata TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN platform_user_flow_svg TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN platform_hifi_full_html TEXT`,
        `ALTER TABLE kickoff_cards ADD COLUMN platform_tsx_mui_json TEXT`,
    ];
    for (const sql of alters) {
        try {
            await db.execute(sql);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!/duplicate column|already exists/i.test(msg)) {
                throw e;
            }
        }
    }
    try {
        await db.execute({
            sql: `UPDATE kickoff_cards SET workspace_id = ? WHERE workspace_id IS NULL OR workspace_id = ''`,
            args: [TEAM_WORKSPACE_ID],
        });
    } catch {
        /* ignore if column just added with default */
    }
}

export async function queryOne<T>(sql: string, args: any[] = []): Promise<T | null> {
    const result = await db.execute({ sql, args });
    return (result.rows[0] as unknown as T) || null;
}

export async function queryAll<T>(sql: string, args: any[] = []): Promise<T[]> {
    const result = await db.execute({ sql, args });
    return result.rows as unknown as T[];
}

export async function run(sql: string, args: any[] = []): Promise<void> {
    await db.execute({ sql, args });
}
