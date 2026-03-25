import { ipcMain } from 'electron';
import { tagRepo } from '../db/repositories';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { Tag } from '../../../types/models';

export function registerTagHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TAGS_LIST, () => {
    return tagRepo.findAll();
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_CREATE, (_, name: string, color?: string) => {
    return tagRepo.create(name, color);
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_UPDATE, (_, id: string, data: Partial<Tag>) => {
    return tagRepo.update(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TAGS_DELETE, (_, id: string) => {
    tagRepo.delete(id);
  });
}
