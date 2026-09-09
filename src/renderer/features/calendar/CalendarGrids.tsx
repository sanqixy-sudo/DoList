import { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { format, isSameMonth } from 'date-fns';
import { useUIStore } from '@/features/settings/uiStore';
import { localDay } from '../tasks/task-selectors';
import { useLocalDay } from '../tasks/use-workspace-tasks';
import { calendarDayTasks, type CalendarIndex } from './calendar-index';
import type { Task } from '../../../../types/models';

export function CalendarTaskChip({ task }: { task: Task }) {
  return <button type="button" data-calendar-task={task.id} className={'calendar-task-chip status-' + task.status + ' priority-' + task.priority}
    aria-label={'打开任务：' + task.title} title={task.title} onClick={() => useUIStore.getState().selectTask(task.id)}>
    <span className="calendar-task-dot" /><span>{task.title}</span>
  </button>;
}
function DayTasks({ tasks, limit, onMore }: { tasks: Task[]; limit: number; onMore: () => void }) {
  return <>{tasks.slice(0, limit).map(task => <CalendarTaskChip key={task.id} task={task} />)}
    {tasks.length > limit && <button type="button" className="calendar-more" onClick={onMore}>另 {tasks.length - limit} 项 · 查看全部</button>}</>;
}
export function MonthGrid({ days, currentDate, index, onOpenDay }: {
  days: Date[]; currentDate: Date; index: CalendarIndex; onOpenDay: (day: string) => void;
}) {
  const today = useLocalDay();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chipLimit, setChipLimit] = useState(1);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      const rowHeight = Math.max(96, (element.clientHeight - 37) / (days.length / 7));
      setChipLimit(Math.max(1, Math.min(3, Math.floor((rowHeight - 62) / 27))));
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, [days.length]);
  return <div className="calendar-grid-scroll" ref={scrollRef}>
    <div className="calendar-weekdays">{['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-month-grid">
      {days.map(day => {
        const key = localDay(day), tasks = calendarDayTasks(index, key);
        return <section key={key} data-calendar-day={key} className={'calendar-day-cell' + (!isSameMonth(day, currentDate) ? ' outside-month' : '')}>
          <div className="calendar-day-heading">
            <button type="button" className={'calendar-day-number' + (key === today ? ' is-today' : '')} aria-current={key === today ? 'date' : undefined}
              aria-label={'查看 ' + key + ' 的任务'} onClick={() => onOpenDay(key)}>{day.getDate()}</button>
            <button type="button" className="calendar-add-day" aria-label={'添加 ' + key + ' 的任务'} onClick={() => useUIStore.getState().openQuickAddForDate(key)}><Plus size={14} /></button>
          </div>
          <DayTasks tasks={tasks} limit={chipLimit} onMore={() => onOpenDay(key)} />
        </section>;
      })}
    </div>
  </div>;
}
export function TimeGrid({ days, index, onOpenDay }: { days: Date[]; index: CalendarIndex; onOpenDay: (day: string) => void }) {
  const today = useLocalDay();
  return <div className="calendar-time-scroll"><div className="calendar-time-grid" style={{ minWidth: days.length > 3 ? 700 : undefined }}>
    <div className="calendar-time-heading" style={{ gridTemplateColumns: '58px repeat(' + days.length + ', minmax(0, 1fr))' }}>
      <span />
      {days.map(day => { const key = localDay(day); return <button key={key} className={key === today ? 'is-today' : ''} onClick={() => onOpenDay(key)}>
        <span>{format(day, 'M/d')}</span><small>{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day.getDay()]}</small>
      </button>; })}
    </div>
    <div className="calendar-time-row calendar-all-day" style={{ gridTemplateColumns: '58px repeat(' + days.length + ', minmax(0, 1fr))' }}>
      <span className="calendar-hour">全天</span>
      {days.map(day => { const key = localDay(day); return <div key={key} data-all-day={key}>
        <DayTasks tasks={index.get(key)?.allDay ?? []} limit={3} onMore={() => onOpenDay(key)} />
      </div>; })}
    </div>
    {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="calendar-time-row" data-hour={hour} style={{ gridTemplateColumns: '58px repeat(' + days.length + ', minmax(0, 1fr))' }}>
      <span className="calendar-hour">{String(hour).padStart(2, '0')}:00</span>
      {days.map(day => { const key = localDay(day); return <div key={key} className={key === today ? 'is-today' : ''}>
        <DayTasks tasks={index.get(key)?.hours[hour] ?? []} limit={2} onMore={() => onOpenDay(key)} />
      </div>; })}
    </div>)}
  </div></div>;
}
