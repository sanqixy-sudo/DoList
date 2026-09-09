import { useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, eachDayOfInterval, format, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/features/settings/uiStore';
import { useWorkspaceTasks } from '@/features/tasks/use-workspace-tasks';
import { TaskViewFeedback } from '../tasks/components/TaskViewFeedback';
import { localDay } from '../tasks/task-selectors';
import { buildCalendarIndex, calendarDayTasks } from './calendar-index';
import { MonthGrid, TimeGrid } from './CalendarGrids';
import { CalendarDayDialog } from './CalendarDayDialog';

const viewLabels = { month: '月视图', multiWeek: '双周视图', week: '周视图', multiDay: '3日视图', day: '日视图' } as const;

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendaDay, setAgendaDay] = useState<string | null>(null);
  const tasks = useWorkspaceTasks();
  const view = useUIStore(s => s.calendarViewType);
  const setView = useUIStore(s => s.setCalendarViewType);
  const index = useMemo(() => buildCalendarIndex(tasks), [tasks]);
  const days = useMemo(() => {
    const start = view === 'month' ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      : view === 'week' || view === 'multiWeek' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    const end = view === 'month' ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      : addDays(start, view === 'multiWeek' ? 13 : view === 'week' ? 6 : view === 'multiDay' ? 2 : 0);
    return eachDayOfInterval({ start, end });
  }, [view, currentDate]);
  const periodCount = useMemo(() => days.reduce((count, day) => count + calendarDayTasks(index, localDay(day)).length, 0), [days, index]);
  const agendaTasks = useMemo(() => agendaDay ? calendarDayTasks(index, agendaDay) : [], [agendaDay, index]);
  const navigate = (direction: number) => setCurrentDate(date => view === 'month' ? addMonths(date, direction)
    : addDays(date, direction * (view === 'multiWeek' ? 14 : view === 'week' ? 7 : view === 'multiDay' ? 3 : 1)));
  const title = view === 'month' ? format(currentDate, 'yyyy年M月') : view === 'day' ? format(currentDate, 'yyyy年M月d日')
    : format(days[0], 'M月d日') + ' — ' + format(days[days.length - 1], 'M月d日');

  return <div className="calendar-view">
    <div className="view-toolbar calendar-toolbar">
      <div className="calendar-period"><button aria-label="上一个日期范围" onClick={() => navigate(-1)}><ChevronLeft size={17} /></button><h2 aria-live="polite">{title}</h2><button aria-label="下一个日期范围" onClick={() => navigate(1)}><ChevronRight size={17} /></button></div>
      <div className="calendar-toolbar-actions"><button className="calendar-today" onClick={() => setCurrentDate(new Date())}>回到今天</button>
        <select aria-label="日历展示范围" value={view} onChange={event => setView(event.target.value as keyof typeof viewLabels)}>{Object.entries(viewLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </div>
    </div>
    <div className="calendar-legend"><span>计划日期优先 · 未设计划时显示截止时间</span><span>{periodCount} 项任务</span></div>
    <TaskViewFeedback />
    {view === 'month' || view === 'multiWeek' ? <MonthGrid days={days} currentDate={currentDate} index={index} onOpenDay={setAgendaDay} />
      : <TimeGrid days={days} index={index} onOpenDay={setAgendaDay} />}
    <CalendarDayDialog day={agendaDay} tasks={agendaTasks} onClose={() => setAgendaDay(null)} />
  </div>;
}
