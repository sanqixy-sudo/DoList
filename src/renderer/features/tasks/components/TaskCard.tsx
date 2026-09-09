import { memo, type ReactNode } from 'react';
import { CalendarDays, Sun, ListChecks, Flag } from 'lucide-react';
import { useListStore } from '@/features/navigation/listStore';
import { dateDay } from '../task-selectors';
import type { Task } from '../../../../../types/models';

export const statusNames = { todo: '待办', done: '已完成', canceled: '已取消' } as const;

export const TaskCard = memo(function TaskCard({ task, onOpen, actions }: {
  task: Task; onOpen: () => void; actions?: ReactNode;
}) {
  const project = useListStore(s => s.lists.find(list => list.id === task.listId)?.name);
  const due = dateDay(task.dueDate);
  return <article className={'task-card status-' + task.status} data-card-id={task.id}>
    <button type="button" className="task-card-open" aria-label={'打开任务：' + task.title} onClick={onOpen}>
      <span className="task-card-title">{task.title}</span>
      <span className="task-card-notes">{task.notes || (task.listId === 'inbox' ? '收件箱' : project)}</span>
      <span className="task-card-dates">
        {task.plannedDate && <span><Sun size={12} />计划 {task.plannedDate.slice(5).replace('-', '/')}</span>}
        {due && <span><CalendarDays size={12} />截止 {due.slice(5).replace('-', '/')}</span>}
        {!task.plannedDate && !due && <span>尚未安排日期</span>}
      </span>
    </button>
    <div className="task-card-footer">
      <span className={'card-priority priority-' + task.priority}>
        {task.priority > 0 ? <><Flag size={12} />{['', '低', '中', '高'][task.priority]}优先级</> : actions ? null : statusNames[task.status]}
      </span>
      {!!task.subtasks?.length && <span className="card-subtasks"><ListChecks size={12} />{task.subtasks.filter(s => s.isDone).length}/{task.subtasks.length}</span>}
      <div className="task-card-actions">{actions}</div>
    </div>
  </article>;
});
