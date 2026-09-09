import fs from 'node:fs';
import { createHash } from 'node:crypto';
export type Statement = { sql: string; params: any[] };
type Entry = { sequence: number; statements: Statement[]; checksum: string };
const checksum = (sequence: number, statements: Statement[]) => createHash('sha256').update(JSON.stringify({ sequence, statements })).digest('hex');
export function syncFile(file: string, bytes: Uint8Array | string) {
  const fd = fs.openSync(file, 'w');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function appendJournal(file: string, sequence: number, statements: Statement[]): number {
  const fd = fs.openSync(file, 'a+'), offset = fs.fstatSync(fd).size;
  try {
    fs.writeFileSync(fd, JSON.stringify({ sequence, statements, checksum: checksum(sequence, statements) }) + '\n');
    fs.fsyncSync(fd);
    return offset;
  } catch (error) {
    try { fs.ftruncateSync(fd, offset); fs.fsyncSync(fd); } catch { /* Preserve the file for startup validation. */ }
    throw error;
  } finally { fs.closeSync(fd); }
}
export function rollbackJournal(file: string, size: number) {
  const fd = fs.openSync(file, 'r+');
  try { fs.ftruncateSync(fd, size); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function replayJournal(file: string, initial: number, apply: (entry: Entry) => void): number {
  if (!fs.existsSync(file)) return initial;
  const bytes = fs.readFileSync(file), end = bytes.lastIndexOf(10) + 1;
  let sequence = initial;
  for (const line of bytes.subarray(0, end).toString('utf8').split('\n').filter(Boolean)) {
    const entry = JSON.parse(line) as Entry;
    if (!Number.isSafeInteger(entry.sequence) || !Array.isArray(entry.statements) || entry.checksum !== checksum(entry.sequence, entry.statements)) throw new Error('事务日志校验失败，原文件已保留');
    if (entry.sequence <= initial) continue;
    if (entry.sequence !== sequence + 1) throw new Error('事务日志序号不连续，原文件已保留');
    apply(entry); sequence = entry.sequence;
  }
  if (end < bytes.length) {
    fs.copyFileSync(file, file + '.partial-' + Date.now());
    rollbackJournal(file, end);
  }
  return sequence;
}
