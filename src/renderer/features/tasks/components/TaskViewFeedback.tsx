import { useTaskStore } from '../store';

export function TaskViewFeedback() {
  const error = useTaskStore(s => s.error);
  const loading = useTaskStore(s => s.isLoading);
  const count = useTaskStore(s => s.tasks.length);
  if (error) return <div role="alert" className="view-feedback inline-error">{error}
    <button onClick={() => void useTaskStore.getState().fetchTasks()}>重新加载</button>
    <button onClick={() => useTaskStore.getState().clearError()}>关闭提示</button>
  </div>;
  return loading && !count ? <p role="status" className="view-feedback">正在读取任务…</p> : null;
}
