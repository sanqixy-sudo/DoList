import type { Task, TaskStatus } from '../../../../types/models';
export function groupBoardTasks(tasks: Task[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  const groups: Record<TaskStatus, Task[]> = { todo: [], done: [], canceled: [] };
  for (const task of tasks) {
    if (keyword && !(task.title + ' ' + (task.notes || '')).toLocaleLowerCase().includes(keyword)) continue;
    groups[task.status].push(task);
  }
  for (const group of Object.values(groups)) group.sort((a, b) => a.sortOrder - b.sortOrder);
  return groups;
}
