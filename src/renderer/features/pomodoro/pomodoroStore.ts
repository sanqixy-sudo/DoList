import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
type PomodoroStatus = 'idle' | 'running' | 'paused';

interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number; // after how many work sessions
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

interface PomodoroState {
  // Current session
  status: PomodoroStatus;
  phase: PomodoroPhase;
  timeRemaining: number; // seconds
  currentTaskId: string | null;

  // Pause confirmation
  showPauseConfirm: boolean;

  // Statistics
  completedPomodoros: number;
  totalWorkTime: number; // seconds
  todayPomodoros: number;
  todayWorkTime: number;
  lastResetDate: string;

  // Settings
  settings: PomodoroSettings;

  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  setTaskId: (taskId: string | null) => void;
  updateSettings: (settings: Partial<PomodoroSettings>) => void;
  confirmPause: () => void;
  dismissPauseConfirm: () => void;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartWork: false,
};

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      phase: 'work',
      timeRemaining: DEFAULT_SETTINGS.workDuration * 60,
      currentTaskId: null,
      showPauseConfirm: false,
      completedPomodoros: 0,
      totalWorkTime: 0,
      todayPomodoros: 0,
      todayWorkTime: 0,
      lastResetDate: new Date().toDateString(),
      settings: DEFAULT_SETTINGS,

      start: () => {
        const state = get();
        // Check if we need to reset daily stats
        const today = new Date().toDateString();
        if (state.lastResetDate !== today) {
          set({
            todayPomodoros: 0,
            todayWorkTime: 0,
            lastResetDate: today,
          });
        }
        set({ status: 'running' });
      },

      pause: () => {
        const { currentTaskId } = get();
        // Always pause the timer first
        set({ status: 'paused' });
        if (currentTaskId) {
          // Show confirmation dialog if there's a task
          set({ showPauseConfirm: true });
        }
      },

      confirmPause: () => set({ showPauseConfirm: false }),

      dismissPauseConfirm: () => set({ showPauseConfirm: false }),

      resume: () => set({ status: 'running' }),

      reset: () => {
        const { settings } = get();
        set({
          status: 'idle',
          phase: 'work',
          timeRemaining: settings.workDuration * 60,
        });
      },

      skip: () => {
        const state = get();
        const { settings } = state;

        let nextPhase: PomodoroPhase;
        let nextDuration: number;

        if (state.phase === 'work') {
          // Determine if it's time for a long break
          const nextPomodoroCount = state.completedPomodoros + 1;
          if (nextPomodoroCount % settings.longBreakInterval === 0) {
            nextPhase = 'longBreak';
            nextDuration = settings.longBreakDuration;
          } else {
            nextPhase = 'shortBreak';
            nextDuration = settings.shortBreakDuration;
          }
        } else {
          nextPhase = 'work';
          nextDuration = settings.workDuration;
        }

        set({
          phase: nextPhase,
          timeRemaining: nextDuration * 60,
          status: 'idle',
        });
      },

      tick: () => {
        const state = get();
        if (state.status !== 'running') return;

        const newTimeRemaining = state.timeRemaining - 1;

        if (newTimeRemaining <= 0) {
          // Phase completed
          const { settings } = state;
          let nextPhase: PomodoroPhase;
          let nextDuration: number;
          let newCompletedPomodoros = state.completedPomodoros;
          let newTotalWorkTime = state.totalWorkTime;
          let newTodayPomodoros = state.todayPomodoros;
          let newTodayWorkTime = state.todayWorkTime;

          if (state.phase === 'work') {
            // Work session completed
            newCompletedPomodoros += 1;
            newTodayPomodoros += 1;
            newTotalWorkTime += settings.workDuration * 60;
            newTodayWorkTime += settings.workDuration * 60;

            // Show notification
            if (Notification.permission === 'granted') {
              new Notification('DoList 番茄钟', {
                body: '工作时间结束！休息一下吧。',
              });
            }

            // Determine break type
            if (newCompletedPomodoros % settings.longBreakInterval === 0) {
              nextPhase = 'longBreak';
              nextDuration = settings.longBreakDuration;
            } else {
              nextPhase = 'shortBreak';
              nextDuration = settings.shortBreakDuration;
            }
          } else {
            // Break completed
            nextPhase = 'work';
            nextDuration = settings.workDuration;

            if (Notification.permission === 'granted') {
              new Notification('DoList 番茄钟', {
                body: '休息结束！开始新的工作吧。',
              });
            }
          }

          const shouldAutoStart =
            (nextPhase === 'work' && settings.autoStartWork) ||
            (nextPhase !== 'work' && settings.autoStartBreaks);

          set({
            phase: nextPhase,
            timeRemaining: nextDuration * 60,
            status: shouldAutoStart ? 'running' : 'idle',
            completedPomodoros: newCompletedPomodoros,
            totalWorkTime: newTotalWorkTime,
            todayPomodoros: newTodayPomodoros,
            todayWorkTime: newTodayWorkTime,
          });
        } else {
          set({ timeRemaining: newTimeRemaining });
        }
      },

      setTaskId: (taskId: string | null) => set({ currentTaskId: taskId }),

      updateSettings: (newSettings: Partial<PomodoroSettings>) => {
        const state = get();
        const updatedSettings = { ...state.settings, ...newSettings };

        // If idle, update time remaining based on new settings
        if (state.status === 'idle') {
          let newDuration: number;
          switch (state.phase) {
            case 'work':
              newDuration = updatedSettings.workDuration;
              break;
            case 'shortBreak':
              newDuration = updatedSettings.shortBreakDuration;
              break;
            case 'longBreak':
              newDuration = updatedSettings.longBreakDuration;
              break;
          }
          set({
            settings: updatedSettings,
            timeRemaining: newDuration * 60,
          });
        } else {
          set({ settings: updatedSettings });
        }
      },
    }),
    {
      name: 'dolist-pomodoro-storage',
      partialize: (state) => ({
        completedPomodoros: state.completedPomodoros,
        totalWorkTime: state.totalWorkTime,
        todayPomodoros: state.todayPomodoros,
        todayWorkTime: state.todayWorkTime,
        lastResetDate: state.lastResetDate,
        settings: state.settings,
      }),
    }
  )
);
