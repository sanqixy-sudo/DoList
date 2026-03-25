import initSqlJs from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { prepareMigrationSql } from './utils/migration-logic';

let db: any = null;
let dbPath = '';
let isDirty = false;
let saveTimeout: NodeJS.Timeout | null = null;

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'ticklike.db');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');

  runMigrations();

  setInterval(() => {
    if (isDirty) {
      saveDatabase();
    }
  }, 60000);
}

function scheduleSave(): void {
  isDirty = true;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveDatabase();
  }, 1000);
}

function saveDatabase(): void {
  if (!db || !isDirty) return;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    isDirty = false;
    console.log('Database saved');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

function runMigrations(): void {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    {
      name: '001_init',
      sql: `
        -- Lists
        CREATE TABLE IF NOT EXISTS lists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Tags
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT
        );

        -- Repeat Rules
        CREATE TABLE IF NOT EXISTS repeat_rules (
          id TEXT PRIMARY KEY,
          freq TEXT NOT NULL,
          interval INTEGER NOT NULL DEFAULT 1,
          by_day TEXT,
          by_month_day TEXT,
          by_month TEXT,
          count INTEGER,
          until TEXT,
          timezone TEXT,
          start_date TEXT,
          next_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Tasks
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          list_id TEXT NOT NULL,
          title TEXT NOT NULL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'todo',
          priority INTEGER NOT NULL DEFAULT 0,
          start_date TEXT,
          due_date TEXT,
          completed_at TEXT,
          completion INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          repeat_rule_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
          FOREIGN KEY (repeat_rule_id) REFERENCES repeat_rules(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_list_due ON tasks(list_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date);

        -- Subtasks
        CREATE TABLE IF NOT EXISTS subtasks (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          is_done INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

        -- Task Tags (M:N)
        CREATE TABLE IF NOT EXISTS task_tags (
          task_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (task_id, tag_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        -- Reminders
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          remind_at TEXT NOT NULL,
          method TEXT NOT NULL DEFAULT 'local',
          is_sent INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(is_sent, remind_at);

        -- Create default Inbox list
        INSERT OR IGNORE INTO lists (id, name, color, sort_order)
        VALUES ('inbox', '收件箱', '#4A90D9', 0);
      `,
    },
    {
      name: '002_project_groups',
      sql: `
        CREATE TABLE IF NOT EXISTS project_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO project_groups (id, name, color, sort_order)
        VALUES ('default-group', '默认项目集', '#0f766e', 0);

        ALTER TABLE lists ADD COLUMN project_group_id TEXT REFERENCES project_groups(id) ON DELETE SET NULL;

        UPDATE lists
        SET project_group_id = 'default-group'
        WHERE id != 'inbox' AND (project_group_id IS NULL OR project_group_id = '');

        CREATE INDEX IF NOT EXISTS idx_lists_group_sort ON lists(project_group_id, sort_order);
      `,
    },
    {
      name: '003_task_attachments',
      sql: `
        CREATE TABLE IF NOT EXISTS task_attachments (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          mime_type TEXT,
          file_size INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_task_attachments_task_created
        ON task_attachments(task_id, created_at DESC);
      `,
    },
  ];

  for (const migration of migrations) {
    if (hasAppliedMigration(migration.name)) continue;

    applyMigration(
      migration.name,
      prepareMigrationSql(migration.name, migration.sql, {
        projectGroupColumnExists: columnExists('lists', 'project_group_id'),
      })
    );
  }

  isDirty = true;
  saveDatabase();
}

function hasAppliedMigration(name: string): boolean {
  return Boolean(dbGet('SELECT 1 FROM migrations WHERE name = ?', [name]));
}

function applyMigration(name: string, sql: string): void {
  try {
    db.run('BEGIN TRANSACTION');
    db.exec(sql);
    db.run('INSERT INTO migrations (name) VALUES (?)', [name]);
    db.run('COMMIT');
    console.log(`Applied migration: ${name}`);
  } catch (error) {
    try {
      db.run('ROLLBACK');
    } catch {
      // Ignore rollback failures when the transaction never began cleanly.
    }

    console.error(`Failed to apply migration: ${name}`, error);
    throw error;
  }
}

function columnExists(tableName: string, columnName: string): boolean {
  const rows = dbAll(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

export function closeDatabase(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  if (db) {
    isDirty = true;
    saveDatabase();
    db.close();
    db = null;
  }
}

export function dbRun(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  scheduleSave();
}

export function dbGet(sql: string, params: any[] = []): any {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }

  stmt.free();
  return null;
}

export function dbAll(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
