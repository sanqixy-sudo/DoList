import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { app, BrowserWindow } from 'electron';
import { exportDatabaseSnapshot, getDatabaseDirectory, lockDatabaseWrites, replaceDatabaseSnapshot } from '../db/client';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { BackupProgress } from '../../../types/backup';
let active: { flag: Int32Array; progress: BackupProgress } | null = null;
export function backupBusy() { return active !== null; }
export function cancelBackup() {
  if (active?.progress.canCancel) Atomics.store(active.flag, 0, 1);
}
export function getBackupProgress() { return active?.progress ?? null; }
function publish(progress: BackupProgress | null) {
  if (active && progress) active.progress = progress;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(IPC_CHANNELS.BACKUP_PROGRESS, progress);
  }
}
async function removeGenerated(folder: string, parent: string) {
  if (path.dirname(path.resolve(folder)) !== path.resolve(parent)) throw new Error('拒绝清理非受控目录');
  await fs.promises.rm(folder, { recursive: true, force: true });
}
export async function runBackupJob(operation: 'export' | 'preview' | 'restore', options: { destination?: string; file?: string; fingerprint?: string }) {
  if (active) throw new Error('已有备份操作正在进行');
  const unlock = lockDatabaseWrites();
  const directory = getDatabaseDirectory(), jobsRoot = path.join(directory, 'backup-jobs');
  const folder = path.join(jobsRoot, randomUUID()), restoreRoot = path.join(directory, 'restored-attachments');
  const restoreFolder = path.join(restoreRoot, randomUUID());
  const cancel = new SharedArrayBuffer(4);
  active = { flag: new Int32Array(cancel), progress: { phase: '准备备份', percent: 0, canCancel: true } };
  let committed = false, worker: Worker | null = null, destinationTemp: string | null = null;
  try {
    await fs.promises.mkdir(folder, { recursive: true });
    publish(active.progress);
    const output = path.join(folder, 'export.dolist-backup');
    const result: any = await new Promise((resolve, reject) => {
      worker = new Worker((app.isPackaged ? path.join(app.getAppPath(), 'dist/main/backup-worker.js') : path.resolve('dist/main/backup-worker.js')), { workerData: {
        operation, snapshot: exportDatabaseSnapshot(), directory, cancel, output, restoreFolder, ...options,
      } });
      worker.on('message', message => {
        if (message.progress) publish(message.progress);
        else if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code !== 0) reject(new Error('备份工作线程异常退出')); });
    });
    if (Atomics.load(active.flag, 0)) throw new Error('备份操作已取消');
    publish({ phase: '完成写入', percent: 98, canCancel: false });
    if (operation === 'export') {
      destinationTemp = options.destination + '.' + randomUUID() + '.tmp';
      await fs.promises.copyFile(output, destinationTemp, fs.constants.COPYFILE_EXCL);
      const fd = await fs.promises.open(destinationTemp, 'r+');
      try { await fd.sync(); } finally { await fd.close(); }
      await fs.promises.rename(destinationTemp, options.destination!);
      return { ...result, path: options.destination, summary: { ...result.summary, fileName: path.basename(options.destination!) } };
    }
    if (operation === 'restore') {
      replaceDatabaseSnapshot(result.snapshot); committed = true;
      return { safetyBackupPath: result.safetyBackupPath };
    }
    return result;
  } finally {
    if (worker) await (worker as Worker).terminate();
    if (destinationTemp) await fs.promises.unlink(destinationTemp).catch(() => {});
    if (!committed) await removeGenerated(restoreFolder, restoreRoot).catch(() => {});
    await removeGenerated(folder, jobsRoot).catch(() => {});
    active = null; unlock(); publish(null);
  }
}
