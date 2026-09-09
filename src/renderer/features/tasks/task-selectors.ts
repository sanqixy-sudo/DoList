import { validDay } from '../../../../types/validation';
import type { Task } from '../../../../types/models';
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateDay(value: string | null): string | null {
  if (!value) return null;
  if (validDay(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDay(date);
}
export function isTodayTask(task: Task, today: string): boolean {
  return task.status === 'todo' && (task.plannedDate === today || dateDay(task.dueDate) === today);
}
export function needsReschedule(task: Task, today: string): boolean {
  if (task.status !== 'todo' || isTodayTask(task, today)) return false;
  const due = dateDay(task.dueDate);
  return Boolean((task.plannedDate && task.plannedDate < today) || (due && due < today));
}
export function selectScope(tasks: Task[], view: string, listId: string | null, today: string): Task[] {
  if (view === 'today') return tasks.filter(t => isTodayTask(t, today) || needsReschedule(t, today) || (t.status === 'done' && dateDay(t.completedAt) === today));
  if (view === 'inbox') return tasks.filter(t => t.listId === 'inbox');
  if (view === 'list') return tasks.filter(t => t.listId === listId);
  if (view === 'upcoming') return tasks.filter(t => t.plannedDate || t.dueDate);
  return tasks;
}
export function calendarDate(task: Task): string | null {
  return task.plannedDate ? `${task.plannedDate}T00:00:00` : task.dueDate;
}
