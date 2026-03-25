import { Notification } from 'electron';
import path from 'path';
import { reminderRepo } from '../db/repositories';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  schedulerInterval = setInterval(checkReminders, 30000);
  checkReminders();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

function checkReminders(): void {
  try {
    const pendingReminders = reminderRepo.findPending();

    for (const reminder of pendingReminders) {
      const notification = new Notification({
        title: 'DoList 提醒',
        body: (reminder as any).taskTitle || '任务提醒',
        icon: path.join(__dirname, '../../resources/icon.png'),
        silent: false,
      });

      notification.show();
      reminderRepo.markSent(reminder.id);
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}
