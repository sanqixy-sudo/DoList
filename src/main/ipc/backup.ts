import { safeIpc as ipcMain } from './validated-ipc';
import { clearUndo } from '../db/repositories/task-undo';
import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { runBackupJob, cancelBackup, getBackupProgress } from '../backup/coordinator';
import { IPC_CHANNELS } from '../../../types/ipc';
let preview: { token: string; path: string; fingerprint: string } | null = null;
export function registerBackupHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.BACKUP_CANCEL, cancelBackup);
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_PROGRESS, getBackupProgress);
  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, async () => {
    const selection = await dialog.showSaveDialog({ title: '导出完整备份', defaultPath: 'DoList-' + new Date().toISOString().slice(0,10) + '.dolist-backup', filters: [{ name: 'DoList 备份', extensions: ['dolist-backup'] }] });
    if (selection.canceled || !selection.filePath) return null;
    return runBackupJob('export', { destination: selection.filePath });
  });
  ipcMain.handle(IPC_CHANNELS.BACKUP_PREVIEW, async () => {
    preview = null;
    const selection = await dialog.showOpenDialog({ title: '选择要恢复的备份', properties: ['openFile'], filters: [{ name: 'DoList 备份', extensions: ['dolist-backup'] }] });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const file = selection.filePaths[0], inspected = await runBackupJob('preview', { file }), token = randomUUID();
    preview = { token, path: file, fingerprint: inspected.fingerprint };
    return { ...inspected.summary, token };
  });
  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (_event, token: string) => {
    if (!preview || token !== preview.token) throw new Error('备份预览已过期，请重新选择');
    const result = await runBackupJob('restore', { file: preview.path, fingerprint: preview.fingerprint });
    preview = null; clearUndo();
    return result;
  });
}
