// backend/src/db/database.ts

import { createClient } from '@libsql/client';
import { config } from '../config/env.js';

export const db = createClient({
    url: config.TURSO_DATABASE_URL || 'file:local.db',
    authToken: config.TURSO_AUTH_TOKEN,
});

export async function initDatabase() {
    await db.execute(`
    CREATE TABLE IF NOT EXISTS user_stories (
      id TEXT PRIMARY KEY,
      jira_key TEXT UNIQUE NOT NULL,
      jira_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      current_level INTEGER DEFAULT 0,
      is_generating INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    try {
        await db.execute(
            `ALTER TABLE user_stories ADD COLUMN is_generating INTEGER NOT NULL DEFAULT 0`
        );
    } catch {
        /* columna ya existe */
    }

    await db.execute(`
    CREATE TABLE IF NOT EXISTS design_outputs (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      feedback TEXT,
      jira_attachment_id TEXT,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES user_stories(id)
    )
  `);

    try {
        await db.execute(
            `ALTER TABLE design_outputs ADD COLUMN meta TEXT`
        );
    } catch {
        /* columna ya existe */
    }

    await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      action TEXT NOT NULL,
      jira_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    console.log('✓ Database initialized');
}

export async function queryOne<T>(sql: string, args: any[] = []): Promise<T | null> {
    const result = await db.execute({ sql, args });
    return (result.rows[0] as unknown as T) || null;
}

export async function queryAll<T>(sql: string, args: any[] = []): Promise<T[]> {
    const result = await db.execute({ sql, args });
    return result.rows as unknown as T[];
}

export async function run(sql: string, args: any[] = []) {
    return db.execute({ sql, args });
}