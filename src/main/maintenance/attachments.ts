import fs from 'node:fs';
import path from 'node:path';
import { dbAll, getDatabaseDirectory, lockDatabaseWrites } from '../db/client';
export interface CleanupResult { files: number; bytes: number; failed: number; skipped: number }
function roots() { const base = getDatabaseDirectory(); return ['attachments','restored-attachments','backup-jobs'].map(name => path.resolve(base, name)); }
function referenced() { return new Set(dbAll('SELECT file_path FROM task_attachments').map(row => path.resolve(row.file_path).toLowerCase())); }
async function inventory() {
  const found: { file: string; size: number }[] = [], references = referenced();
  async function visit(folder: string, root: string) {
    const stat = await fs.promises.lstat(folder).catch(() => null);
    if (!stat || stat.isSymbolicLink()) return;
    if (stat.isFile()) { if (!references.has(folder.toLowerCase())) found.push({ file: folder, size: stat.size }); return; }
    for (const name of await fs.promises.readdir(folder)) {
      const file = path.resolve(folder, name), relative = path.relative(root, file);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await visit(file, root);
    }
  }
  for (const root of roots()) await visit(root, root);
  return found;
}
export async function scanUnusedAttachments() {
  const unlock = lockDatabaseWrites();
  try { const files = await inventory(); return { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0), failed: 0, skipped: 0 }; }
  finally { unlock(); }
}
export async function cleanupUnusedAttachments(): Promise<CleanupResult> {
  const unlock = lockDatabaseWrites();
  try {
    const files = await inventory(), references = referenced();
    const result = { files: 0, bytes: 0, failed: 0, skipped: 0 };
    for (const entry of files) {
      if (references.has(entry.file.toLowerCase())) { result.skipped++; continue; }
      try {
        // Recheck every ancestor immediately before deletion; never follow a junction.
        const root = roots().find(root => entry.file.startsWith(root + path.sep));
        if (!root) { result.skipped++; continue; }
        let cursor = entry.file, unsafe = false;
        while (true) {
          const stat = await fs.promises.lstat(cursor);
          if (stat.isSymbolicLink()) { unsafe = true; break; }
          if (cursor === root) break;
          cursor = path.dirname(cursor);
        }
        if (unsafe) { result.skipped++; continue; }
        await fs.promises.unlink(entry.file); result.files++; result.bytes += entry.size;
      } catch { result.failed++; }
    }
    return result;
  } finally { unlock(); }
}
