import type { Task } from './models';
export interface UndoInfo { token: string; label: string; count: number }
export interface TaskUpdateResult { task: Task; undo: UndoInfo | null }
export interface TaskBulkResult { tasks: Task[]; undo: UndoInfo | null }
