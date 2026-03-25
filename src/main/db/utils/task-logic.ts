import type { TaskFilter } from '../../../../types/ipc';

export function localDateExpression(columnName: string): string {
  return `date(${columnName}, 'localtime')`;
}

export function buildDueDateClause(
  dueDate: TaskFilter['dueDate'],
  columnName = 'due_date'
): { sql: string; params: unknown[] } {
  if (!dueDate) {
    return { sql: '', params: [] };
  }

  const dateColumn = localDateExpression(columnName);

  switch (dueDate) {
    case 'today':
      return {
        sql: ` AND ${dateColumn} = date('now', 'localtime')`,
        params: [],
      };
    case 'week':
      return {
        sql: ` AND ${dateColumn} BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')`,
        params: [],
      };
    case 'month':
      return {
        sql: ` AND ${dateColumn} BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')`,
        params: [],
      };
    case 'overdue':
      return {
        sql: ` AND ${dateColumn} < date('now', 'localtime') AND status = "todo"`,
        params: [],
      };
    default:
      return { sql: '', params: [] };
  }
}

export function resolveTaskSortOrder(options: {
  currentListId: string;
  nextListId?: string;
  explicitSortOrder?: number;
  nextSortOrder: number;
}): number | undefined {
  if (options.explicitSortOrder !== undefined) {
    return options.explicitSortOrder;
  }

  if (options.nextListId !== undefined && options.nextListId !== options.currentListId) {
    return options.nextSortOrder;
  }

  return undefined;
}

export function buildPlaceholders(count: number): string {
  if (count <= 0) {
    throw new Error('Placeholder count must be greater than zero');
  }

  return Array.from({ length: count }, () => '?').join(', ');
}
