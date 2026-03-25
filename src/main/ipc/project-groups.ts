import { ipcMain } from 'electron';
import { projectGroupRepo } from '../db/repositories';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { CreateProjectGroupDto, ProjectGroup } from '../../../types/models';

export function registerProjectGroupHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_LIST, () => {
    return projectGroupRepo.findAll();
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_GET, (_, id: string) => {
    return projectGroupRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_CREATE, (_, data: CreateProjectGroupDto) => {
    return projectGroupRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_UPDATE, (_, id: string, data: Partial<ProjectGroup>) => {
    return projectGroupRepo.update(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_DELETE, (_, id: string) => {
    projectGroupRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GROUPS_REORDER, (_, ids: string[]) => {
    projectGroupRepo.reorder(ids);
  });
}
