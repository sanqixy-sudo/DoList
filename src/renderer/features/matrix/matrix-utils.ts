import { AlertTriangle, Clock, Coffee, Trash2 } from 'lucide-react';
import type { Task, UpdateTaskDto } from '../../../../types/models';

export type MatrixQuadrantId =
  | 'urgent-important'
  | 'not-urgent-important'
  | 'urgent-not-important'
  | 'not-urgent-not-important';

export interface MatrixQuadrant {
  id: MatrixQuadrantId;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  filter: (task: Task) => boolean;
}

export function isUrgent(task: Task): boolean {
  if (!task.dueDate) return false;

  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
}

export function getUrgentDueDate(): string {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export const matrixQuadrants: MatrixQuadrant[] = [
  {
    id: 'urgent-important',
    title: '紧急且重要',
    subtitle: '立即处理',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    filter: (task) => task.priority === 3 && isUrgent(task),
  },
  {
    id: 'not-urgent-important',
    title: '重要不紧急',
    subtitle: '计划安排',
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    filter: (task) => task.priority === 3 && !isUrgent(task),
  },
  {
    id: 'urgent-not-important',
    title: '紧急不重要',
    subtitle: '委托他人',
    icon: Coffee,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    filter: (task) => task.priority !== 3 && isUrgent(task),
  },
  {
    id: 'not-urgent-not-important',
    title: '不紧急不重要',
    subtitle: '考虑删除',
    icon: Trash2,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    filter: (task) => task.priority !== 3 && !isUrgent(task),
  },
];

export function getMatrixQuadrantUpdates(quadrantId: MatrixQuadrantId): Pick<UpdateTaskDto, 'priority' | 'dueDate'> {
  switch (quadrantId) {
    case 'urgent-important':
      return { priority: 3, dueDate: getUrgentDueDate() };
    case 'not-urgent-important':
      return { priority: 3, dueDate: null };
    case 'urgent-not-important':
      return { priority: 1, dueDate: getUrgentDueDate() };
    case 'not-urgent-not-important':
    default:
      return { priority: 0, dueDate: null };
  }
}

export function getTaskQuadrantId(task: Task): MatrixQuadrantId {
  const matched = matrixQuadrants.find((quadrant) => quadrant.filter(task));
  return matched?.id ?? 'not-urgent-not-important';
}

export function formatMatrixTaskMeta(task: Task): string {
  const pieces: string[] = [];

  if (task.priority === 3) pieces.push('高优先级');
  if (task.priority === 2) pieces.push('中优先级');
  if (task.priority === 1) pieces.push('低优先级');

  if (task.dueDate) {
    pieces.push(
      new Date(task.dueDate).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      })
    );
  }

  return pieces.join(' · ');
}
