import { ipcMain } from 'electron';
import { listRepo } from '../db/repositories';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { CreateListDto, List } from '../../../types/models';

export function registerListHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LISTS_LIST, () => {
    return listRepo.findAll();
  });

  ipcMain.handle(IPC_CHANNELS.LISTS_GET, (_, id: string) => {
    return listRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.LISTS_CREATE, (_, data: CreateListDto) => {
    return listRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.LISTS_UPDATE, (_, id: string, data: Partial<List>) => {
    return listRepo.update(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.LISTS_DELETE, (_, id: string) => {
    listRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.LISTS_REORDER, (_, ids: string[]) => {
    listRepo.reorder(ids);
  });
}
