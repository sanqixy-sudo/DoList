import { ipcMain } from 'electron';
import { subtaskRepo } from '../db/repositories';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { CreateSubtaskDto, Subtask } from '../../../types/models';

export function registerSubtaskHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SUBTASKS_CREATE, (_, data: CreateSubtaskDto) => {
    return subtaskRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.SUBTASKS_UPDATE, (_, id: string, data: Partial<Subtask>) => {
    return subtaskRepo.update(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.SUBTASKS_DELETE, (_, id: string) => {
    subtaskRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.SUBTASKS_TOGGLE, (_, id: string) => {
    return subtaskRepo.toggle(id);
  });

  ipcMain.handle(IPC_CHANNELS.SUBTASKS_REORDER, (_, taskId: string, ids: string[]) => {
    subtaskRepo.reorder(taskId, ids);
  });
}
