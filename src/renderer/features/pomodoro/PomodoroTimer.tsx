import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePomodoroStore } from './pomodoroStore';
import { useUIStore } from '@/features/settings/uiStore';
import { useTaskStore } from '@/features/tasks/store';
import { TaskSelector } from './components/TaskSelector';
import { PauseConfirmDialog } from './components/PauseConfirmDialog';

export function PomodoroTimer() {
  const {
    status,
    phase,
    timeRemaining,
    currentTaskId,
    todayPomodoros,
    settings,
    showPauseConfirm,
    start,
    pause,
    resume,
    reset,
    skip,
    tick,
    setTaskId,
    confirmPause,
    dismissPauseConfirm,
  } = usePomodoroStore();

  const { isPomodoroOpen, togglePomodoro, pomodoroTaskId } = useUIStore();
  const { tasks, toggleTask } = useTaskStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pomodoroTaskId) {
      setTaskId(pomodoroTaskId);
    }
  }, [pomodoroTaskId, setTaskId]);

  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, tick]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (!isPomodoroOpen) return null;

  const currentTask = currentTaskId ? tasks.find((task) => task.id === currentTaskId) : null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const totalDuration =
    phase === 'work'
      ? settings.workDuration * 60
      : phase === 'shortBreak'
        ? settings.shortBreakDuration * 60
        : settings.longBreakDuration * 60;

  const progress = ((totalDuration - timeRemaining) / totalDuration) * 100;

  const phaseLabels = {
    work: '专注时间',
    shortBreak: '短休息',
    longBreak: '长休息',
  };

  const phaseColors = {
    work: 'text-red-500',
    shortBreak: 'text-green-500',
    longBreak: 'text-blue-500',
  };

  const handleCompleteTask = async () => {
    if (currentTaskId) {
      await toggleTask(currentTaskId);
    }
    reset();
    dismissPauseConfirm();
    setTaskId(null);
  };

  const handleContinue = () => {
    confirmPause();
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-background border rounded-lg shadow-lg p-4 w-72">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">番茄钟</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={togglePomodoro}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {status !== 'running' && (
            <div className="mb-4">
              <TaskSelector
                selectedTaskId={currentTaskId}
                onSelect={setTaskId}
              />
            </div>
          )}

          <div className={cn('text-center text-sm font-medium mb-2', phaseColors[phase])}>
            {phaseLabels[phase]}
          </div>

          <div className="relative flex items-center justify-center mb-4">
            <svg
              className="w-40 h-40 transform -rotate-90"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${phaseLabels[phase]} 进度`}
            >
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={2 * Math.PI * 70 * (1 - progress / 100)}
                strokeLinecap="round"
                className={cn(
                  'transition-all duration-1000',
                  phase === 'work' ? 'text-red-500' : phase === 'shortBreak' ? 'text-green-500' : 'text-blue-500'
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold">{timeDisplay}</span>
              <span className="text-xs text-muted-foreground mt-1">
                今日: {todayPomodoros} 个番茄
              </span>
            </div>
          </div>

          {status === 'running' && currentTask && (
            <div className="text-center text-sm text-muted-foreground mb-4 truncate px-2">
              正在专注: {currentTask.title}
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={reset} title="重置">
              <RotateCcw className="h-4 w-4" />
            </Button>

            {status === 'running' ? (
              <Button size="lg" onClick={pause} className="px-8">
                <Pause className="h-5 w-5 mr-2" />
                暂停
              </Button>
            ) : (
              <Button size="lg" onClick={status === 'paused' ? resume : start} className="px-8">
                <Play className="h-5 w-5 mr-2" />
                {status === 'paused' ? '继续' : '开始'}
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={skip} title="跳过">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <PauseConfirmDialog
        open={showPauseConfirm}
        onOpenChange={dismissPauseConfirm}
        taskTitle={currentTask?.title || ''}
        onComplete={handleCompleteTask}
        onContinue={handleContinue}
      />
    </>
  );
}
