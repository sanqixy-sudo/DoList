import { ipcMain } from 'electron';
import { reminderRepo } from '../db/repositories';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { CreateReminderDto } from '../../../types/models';

export function registerReminderHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.REMINDERS_CREATE, (_, data: CreateReminderDto) => {
    return reminderRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.REMINDERS_DELETE, (_, id: string) => {
    reminderRepo.delete(id);
  });
}
