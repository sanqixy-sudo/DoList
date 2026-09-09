import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { syncFile } from '../db/journal';
import { getDatabaseDirectory, getDatabase, exportDatabaseSnapshot, replaceDatabaseSnapshot, openDatabaseSnapshot } from '../db/client';
import type { BackupSummary } from '../../../types/backup';

let hooks = { check: () => {}, progress: (_phase: string, _percent: number) => {} };
export function setBackupHooks(next: typeof hooks) { hooks = next; }
function progress(phase: string, percent: number) { hooks.check(); hooks.progress(phase, percent); }
const MAX_RAW = 512 * 1024 * 1024;
const MAX_FILE = 256 * 1024 * 1024;
type Archive = { format: 'DoList'; version: 1; createdAt: string; database: string; files: { id: string; data: string; hash: string }[] };
const hash = (bytes: Buffer | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function rows(db: any, sql: string): any[] {
  const statement = db.prepare(sql), result = [];
  try { while (statement.step()) result.push(statement.getAsObject()); } finally { statement.free(); }
  return result;
}
function schema(db: any): string {
  return JSON.stringify(rows(db, "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"));
}
function encode(): { bytes: Buffer; summary: BackupSummary } {
  const db = getDatabase(), files: Archive['files'] = [];
  let size = 0;
  const attachments = rows(db, 'SELECT id, file_path FROM task_attachments');
  for (const row of attachments) {
    progress('读取附件', Math.round(files.length / Math.max(attachments.length, 1) * 55));
    // Missing files must be visible as an export failure, never a silently incomplete backup.
    const stat = fs.statSync(row.file_path);
    size += stat.size;
    if (!stat.isFile() || size > MAX_RAW / 2) throw new Error('附件过大，无法创建完整备份');
    const content = fs.readFileSync(row.file_path);
    files.push({ id: row.id, data: content.toString('base64'), hash: hash(content) });
  }
  const archive: Archive = { format: 'DoList', version: 1, createdAt: new Date().toISOString(), database: Buffer.from(exportDatabaseSnapshot()).toString('base64'), files };
  progress('压缩备份', 60);
  const raw = Buffer.from(JSON.stringify(archive));
  if (raw.length > MAX_RAW) throw new Error('备份数据超过支持的大小');
  const bytes = gzipSync(raw);
  progress('写入备份', 90);
  if (bytes.length > MAX_FILE) throw new Error('备份文件超过支持的大小');
  return { bytes, summary: summarize(db, archive, bytes.length, '') };
}
function summarize(db: any, archive: Archive, bytes: number, fileName: string): BackupSummary {
  return { fileName, createdAt: archive.createdAt, bytes,
    tasks: rows(db, 'SELECT COUNT(*) AS count FROM tasks WHERE deleted_at IS NULL')[0].count,
    trashed: rows(db, 'SELECT COUNT(*) AS count FROM tasks WHERE deleted_at IS NOT NULL')[0].count,
    projects: rows(db, "SELECT COUNT(*) AS count FROM lists WHERE id != 'inbox'")[0].count,
    attachments: archive.files.length };
}
function decode(file: string) {
  progress('读取与解压', 10);
  if (fs.statSync(file).size > MAX_FILE) throw new Error('备份文件过大');
  const bytes = fs.readFileSync(file);
  const archive = JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_RAW }).toString('utf8')) as Archive;
  if (archive.format !== 'DoList' || archive.version !== 1 || !Number.isFinite(Date.parse(archive.createdAt)) || typeof archive.database !== 'string' || !Array.isArray(archive.files)) throw new Error('不支持的备份格式');
  progress('校验数据库', 35);
  const database = Buffer.from(archive.database, 'base64');
  if (!database.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))) throw new Error('备份数据库无效');
  const db = openDatabaseSnapshot(database);
  try {
    if (rows(db, 'PRAGMA quick_check')[0]?.quick_check !== 'ok' || rows(db, 'PRAGMA foreign_key_check').length) throw new Error('备份数据校验失败');
    if (schema(db) !== schema(getDatabase()) || rows(db, "SELECT name FROM sqlite_master WHERE type IN ('trigger','view')").length) throw new Error('备份数据库版本或结构不兼容');
    if (!rows(db, "SELECT id FROM lists WHERE id = 'inbox'").length) throw new Error('备份缺少收件箱');
    const attachments = rows(db, 'SELECT id, name FROM task_attachments');
    const byId = new Map(archive.files.map(file => [file.id, file]));
    if (byId.size !== archive.files.length || attachments.length !== byId.size) throw new Error('备份附件不完整');
    for (const row of attachments) {
      hooks.check();
      const file = byId.get(row.id);
      if (!file || typeof file.data !== 'string' || hash(Buffer.from(file.data, 'base64')) !== file.hash) throw new Error('备份附件校验失败');
    }
    return { bytes, archive, db, attachments, summary: summarize(db, archive, bytes.length, path.basename(file)) };
  } catch (error) { db.close(); throw error; }
}
function atomicWrite(destination: string, bytes: Buffer): void {
  const temp = destination + '.' + randomUUID() + '.tmp';
  try { syncFile(temp, bytes); hooks.check(); fs.renameSync(temp, destination); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function exportBackup(destination: string) {
  const { bytes, summary } = encode();
  atomicWrite(destination, bytes);
  return { path: destination, summary: { ...summary, fileName: path.basename(destination) } };
}
export function inspectBackup(file: string) {
  const decoded = decode(file);
  try { return { summary: decoded.summary, fingerprint: hash(decoded.bytes) }; }
  finally { decoded.db.close(); }
}
export function prepareRestore(file: string, fingerprint: string, restoreFolder?: string) {
  const decoded = decode(file);
  let folder: string | undefined;
  try {
    if (hash(decoded.bytes) !== fingerprint) throw new Error('备份文件已变化，请重新选择并预览');
    const backupFolder = path.join(getDatabaseDirectory(), 'backups');
    fs.mkdirSync(backupFolder, { recursive: true });
    const safetyBackupPath = path.join(backupFolder, 'before-restore-' + Date.now() + '-' + randomUUID() + '.dolist-backup');
    exportBackup(safetyBackupPath);
    // Restore into a new managed directory. Existing attachment files are never overwritten.
    folder = restoreFolder ?? path.join(getDatabaseDirectory(), 'restored-attachments', randomUUID());
    fs.mkdirSync(folder, { recursive: true });
    const files = new Map(decoded.archive.files.map(file => [file.id, file]));
    progress('恢复附件', 70);
    for (const row of decoded.attachments) {
      hooks.check();
      const extension = path.extname(row.name);
      const storedName = randomUUID() + (/^\.[a-z0-9]{1,10}$/i.test(extension) ? extension : '');
      const filePath = path.join(folder, storedName);
      syncFile(filePath, Buffer.from(files.get(row.id)!.data, 'base64'));
      decoded.db.run('UPDATE task_attachments SET file_path = ?, stored_name = ? WHERE id = ?', [filePath, storedName, row.id]);
    }
    const snapshot = decoded.db.export();
    hooks.check();
    const prepared = { safetyBackupPath, snapshot, folder };
    folder = undefined;
    return prepared;
  } finally {
    decoded.db.close();
    // The directory was generated under userData above; only this attempt's new files can be removed.
    const managedRoot = path.resolve(getDatabaseDirectory(), 'restored-attachments');
    if (folder && path.dirname(path.resolve(folder)) === managedRoot) fs.rmSync(folder, { recursive: true, force: true });
  }
}

export function restoreBackup(file: string, fingerprint: string): { safetyBackupPath: string } {
  const prepared = prepareRestore(file, fingerprint);
  try { replaceDatabaseSnapshot(prepared.snapshot); return { safetyBackupPath: prepared.safetyBackupPath }; }
  catch (error) {
    const root = path.resolve(getDatabaseDirectory(), 'restored-attachments');
    if (path.dirname(path.resolve(prepared.folder)) === root) fs.rmSync(prepared.folder, { recursive: true, force: true });
    throw error;
  }
}
