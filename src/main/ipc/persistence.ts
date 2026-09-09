import { scanUnusedAttachments, cleanupUnusedAttachments } from '../maintenance/attachments';
import { safeIpc as ipcMain } from './validated-ipc';
import { BrowserWindow } from 'electron';
import { flushDatabase, getSaveStatus, onSaveStatus } from '../db/client';
import { IPC_CHANNELS } from '../../../types/ipc';
export function registerPersistenceHandlers() {
  ipcMain.handle('app:scanAttachments', scanUnusedAttachments);
  ipcMain.handle('app:cleanupAttachments', cleanupUnusedAttachments);
  ipcMain.handle(IPC_CHANNELS.APP_SAVE_STATUS, getSaveStatus);
  ipcMain.handle(IPC_CHANNELS.APP_FLUSH_DATABASE, flushDatabase);
  onSaveStatus(status => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) window.webContents.send(IPC_CHANNELS.APP_SAVE_STATUS_CHANGED, status);
    }
  });
}
