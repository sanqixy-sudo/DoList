import type { Task } from '../../../../types/models';
import { calendarDate, localDay } from '../tasks/task-selectors';
export function buildCalendarIndex(tasks: Task[]) {
  const index = new Map<string, { allDay: Task[]; hours: Task[][] }>();
  for (const task of tasks) {
    const value = calendarDate(task);
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const key = localDay(date);
    let bucket = index.get(key);
    if (!bucket) { bucket = { allDay: [], hours: Array.from({ length: 24 }, () => []) }; index.set(key, bucket); }
    const allDay = Boolean(task.plannedDate) || (date.getHours() === 0 && date.getMinutes() === 0) || (date.getHours() === 23 && date.getMinutes() === 59 && date.getSeconds() === 59);
    if (allDay) bucket.allDay.push(task); else bucket.hours[date.getHours()].push(task);
  }
  for (const bucket of index.values()) {
    bucket.allDay.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const hour of bucket.hours) {
      hour.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder);
    }
  }
  return index;
}

export type CalendarIndex = ReturnType<typeof buildCalendarIndex>;
export function calendarDayTasks(index: CalendarIndex, day: string): Task[] {
  const bucket = index.get(day);
  return bucket ? [...bucket.allDay, ...bucket.hours.flat()] : [];
}
