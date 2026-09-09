import type { Task } from '../../../../types/models';
import { dateDay, localDay } from './task-selectors';

export function planDate(task: Task): string | null {
  return task.plannedDate || dateDay(task.dueDate);
}

export function groupPlannedTasks(tasks: Task[], today: string) {
  // Local noon keeps date arithmetic stable across daylight-saving transitions.
  const date = new Date(today + 'T12:00:00');
  date.setDate(date.getDate() + 1);
  const tomorrow = localDay(date);
  date.setDate(date.getDate() + 6);
  const weekEnd = localDay(date);
  const groups = [
    { id: 'past', title: '待重新安排', tasks: [] as Task[] },
    { id: 'today', title: '今天', tasks: [] as Task[] },
    { id: 'tomorrow', title: '明天', tasks: [] as Task[] },
    { id: 'week', title: '未来 7 天', tasks: [] as Task[] },
    { id: 'later', title: '之后', tasks: [] as Task[] },
  ];
  for (const task of tasks) {
    const day = planDate(task);
    if (!day || task.status !== 'todo') continue;
    const index = day < today ? 0 : day === today ? 1 : day === tomorrow ? 2 : day <= weekEnd ? 3 : 4;
    groups[index].tasks.push(task);
  }
  for (const group of groups) {
    group.tasks.sort((a, b) => planDate(a)!.localeCompare(planDate(b)!) || a.sortOrder - b.sortOrder);
  }
  return groups.filter(group => group.tasks.length > 0);
}
