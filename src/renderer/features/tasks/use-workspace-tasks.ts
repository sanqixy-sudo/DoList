import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from './store';
import { useUIStore } from '../settings/uiStore';
import { useListStore } from '../navigation/listStore';
import { localDay, selectScope } from './task-selectors';
export function useLocalDay() {
  const [today, setToday] = useState(() => localDay());
  useEffect(() => {
    const update = () => setToday(localDay());
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  return today;
}
export function useWorkspaceTasks() {
  const tasks = useTaskStore(s => s.tasks);
  const view = useUIStore(s => s.currentView);
  const listId = useListStore(s => s.activeListId);
  const today = useLocalDay();
  return useMemo(() => selectScope(tasks, view, listId, today), [tasks, view, listId, today]);
}
