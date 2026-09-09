import { appendJournal, rollbackJournal, replayJournal, syncFile, type Statement } from './journal';
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { SaveStatus } from '../../../types/ipc';
import { prepareMigrationSql } from './utils/migration-logic';

let db: any = null;
let dbPath = '';
let isDirty = false;
let journalReady = false;
let transaction: Statement[] | null = null;
let writeLocked = false;
export function lockDatabaseWrites(): () => void {
  if (writeLocked) throw new Error('已有备份操作正在进行');
  writeLocked = true;
  return () => { writeLocked = false; };
}
export function getDatabaseDirectory() { return path.dirname(dbPath); }
export async function initSnapshotDatabase(bytes: Uint8Array, directory: string) {
  const SQL = await initSqlJs(); db = new SQL.Database(bytes); dbPath = path.join(directory, 'worker-snapshot.db');
  db.run('PRAGMA foreign_keys = ON');
}
let saveTimeout: NodeJS.Timeout | null = null;
let saveInterval: NodeJS.Timeout | null = null;
let saveError: string | null = null;
const saveListeners = new Set<(status: SaveStatus) => void>();
export function getSaveStatus(): SaveStatus { return { pending: isDirty, error: saveError }; }
export function onSaveStatus(listener: (status: SaveStatus) => void): () => void {
  saveListeners.add(listener);
  return () => { saveListeners.delete(listener); };
}
function publishSaveStatus() { saveListeners.forEach(listener => listener(getSaveStatus())); }
export function flushDatabase(): void { saveDatabase(); }
function saveInBackground(): void {
  try { saveDatabase(); } catch { /* Status is published; dirty data remains available for retry. */ }
}

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initDatabase(userDataPath: string): Promise<void> {
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

  journalReady = false;
  runMigrations();
  const initialSequence = dbGet('PRAGMA user_version').user_version;
  const sequence = replayJournal(dbPath + '.journal', initialSequence, entry => {
    db.run('BEGIN');
    try {
      for (const statement of entry.statements) db.run(statement.sql, statement.params);
      db.run('PRAGMA user_version = ' + entry.sequence); db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
  });
  journalReady = true;
  if (sequence !== initialSequence) scheduleSave();

  if (saveInterval) clearInterval(saveInterval);
  saveInterval = setInterval(() => {
    if (isDirty) {
      saveInBackground();
    }
  }, 60000);
}

function scheduleSave(): void {
  isDirty = true;
  publishSaveStatus();
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveInBackground();
  }, 1000);
}

function saveDatabase(): void {
  if (!db || !isDirty) return;

  try {
    const data = exportDatabaseSnapshot();
    const buffer = Buffer.from(data);
    const temporaryPath = `${dbPath}.tmp`;
    syncFile(temporaryPath, buffer);
    fs.renameSync(temporaryPath, dbPath);
    // sql.js export reopens its connection; re-enable FK enforcement.
    db.run('PRAGMA foreign_keys = ON;');
    isDirty = false;
    if (journalReady) { try { syncFile(dbPath + '.journal', ''); } catch { /* Snapshot sequence prevents replaying checkpointed entries. */ } }
    saveError = null;
    publishSaveStatus();
  } catch (error) {
    saveError = '数据尚未写入磁盘，请检查磁盘空间和文件权限后重试。';
    publishSaveStatus();
    throw error;
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
    {
      name: '004_daily_plan',
      sql: `ALTER TABLE tasks ADD COLUMN planned_date TEXT;
            CREATE INDEX IF NOT EXISTS idx_tasks_planned ON tasks(planned_date);`,
    },
    {
      name: '005_task_trash',
      sql: `ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
            CREATE INDEX idx_tasks_deleted ON tasks(deleted_at);`,
    },
  ];

  let migrated = false;
  for (const migration of migrations) {
    if (hasAppliedMigration(migration.name)) continue;

    if (fs.existsSync(dbPath)) {
      const backup = `${dbPath}.before-${migration.name}.bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(dbPath, backup);
    }

    migrated = true;
    applyMigration(
      migration.name,
      prepareMigrationSql(migration.name, migration.sql, {
        projectGroupColumnExists: columnExists('lists', 'project_group_id'),
      })
    );
  }

  if (migrated) { isDirty = true; saveDatabase(); }
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
  saveDatabase();
  if (saveInterval) { clearInterval(saveInterval); saveInterval = null; }
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

export function dbRun(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  if (writeLocked) throw new Error('备份处理中，请稍后重试修改');
  if (!transaction) { dbTransaction(() => dbRun(sql, params)); return; }
  db.run(sql, params);
  transaction.push({ sql, params });
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

/** Bulk writes share one transaction and one fsync. */
export function dbRunMany(sql: string, rows: (string | number | null)[][]): void {
  if (!rows.length) return;
  dbTransaction(() => {
    const statement = db.prepare(sql);
    try { for (const params of rows) { statement.run(params); transaction!.push({ sql, params }); } }
    finally { statement.free(); }
  });
}

export function dbTransaction(action: () => void): void {
  if (writeLocked) throw new Error('备份处理中，请稍后重试修改');
  if (transaction) throw new Error('不支持嵌套事务');
  db.run('BEGIN'); transaction = [];
  let journalOffset: number | null = null;
  try {
    action();
    if (journalReady && transaction.length) {
      const sequence = dbGet('PRAGMA user_version').user_version + 1;
      if (sequence > 2147483647) throw new Error('事务序号达到上限');
      db.run('PRAGMA user_version = ' + sequence);
      journalOffset = appendJournal(dbPath + '.journal', sequence, transaction);
    }
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    if (journalOffset !== null) rollbackJournal(dbPath + '.journal', journalOffset);
    throw error;
  } finally { transaction = null; }
  scheduleSave();
}

export function exportDatabaseSnapshot(): Uint8Array {
  try { return getDatabase().export(); }
  finally { getDatabase().run('PRAGMA foreign_keys = ON'); }
}
export function openDatabaseSnapshot(bytes: Uint8Array): any {
  return new (getDatabase().constructor)(bytes);
}
/** Replace the live database only after the new file was written successfully. */
export function replaceDatabaseSnapshot(bytes: Uint8Array): void {
  const next = openDatabaseSnapshot(bytes);
  const temporaryPath = dbPath + '.restore.tmp';
  try {
    next.run('PRAGMA user_version = ' + (Math.max(dbGet('PRAGMA user_version').user_version, next.exec('PRAGMA user_version')[0].values[0][0]) + 1));
    const snapshot = next.export();
    next.run('PRAGMA foreign_keys = ON');
    syncFile(temporaryPath, snapshot);
    fs.renameSync(temporaryPath, dbPath);
  } catch (error) {
    next.close();
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
  const previous = db; db = next; isDirty = false; saveError = null; publishSaveStatus();
  previous.close();
  try { syncFile(dbPath + '.journal', ''); } catch { /* Older journal entries are below the restored sequence. */ }
}

/** The transaction journal is durable before any attachment is unlinked. */
export function dbDurableTransaction(action: () => void): void { dbTransaction(action); }
