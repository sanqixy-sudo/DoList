import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';
type PomodoroStatus = 'idle' | 'running' | 'paused';
interface PomodoroSettings {
  workDuration: number; shortBreakDuration: number; longBreakDuration: number;
  longBreakInterval: number; autoStartBreaks: boolean; autoStartWork: boolean;
}
interface PomodoroState {
  status: PomodoroStatus; phase: PomodoroPhase; timeRemaining: number;
  deadline: number | null; sessionDuration: number; currentTaskId: string | null;
  showPauseConfirm: boolean; completedPomodoros: number; totalWorkTime: number;
  todayPomodoros: number; todayWorkTime: number; lastResetDate: string;
  settings: PomodoroSettings;
  start: () => void; pause: () => void; resume: () => void; reset: () => void;
  skip: () => void; tick: () => void; setTaskId: (id: string | null) => void;
  updateSettings: (settings: Partial<PomodoroSettings>) => void;
  confirmPause: () => void; dismissPauseConfirm: () => void;
}
const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15,
  longBreakInterval: 4, autoStartBreaks: false, autoStartWork: false,
};
function duration(phase: PomodoroPhase, settings: PomodoroSettings) {
  return (phase === 'work' ? settings.workDuration : phase === 'shortBreak' ? settings.shortBreakDuration : settings.longBreakDuration) * 60;
}
function normalizeSettings(settings: Partial<PomodoroSettings>) {
  const result = { ...DEFAULT_SETTINGS, ...settings };
  for (const key of ['workDuration', 'shortBreakDuration', 'longBreakDuration', 'longBreakInterval'] as const) {
    const value = result[key];
    result[key] = Number.isFinite(value) ? Math.max(1, Math.min(key === 'longBreakInterval' ? 12 : 180, Math.round(value))) : DEFAULT_SETTINGS[key];
  }
  return result;
}
function dailyStats(state: PomodoroState) {
  const today = new Date().toDateString();
  return state.lastResetDate === today ? {} : { todayPomodoros: 0, todayWorkTime: 0, lastResetDate: today };
}
function notify(message: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('DoList 番茄钟', { body: message });
  } catch { /* Notification availability must not interrupt the timer. */ }
}
export const usePomodoroStore = create<PomodoroState>()(persist((set, get) => ({
  status: 'idle', phase: 'work', timeRemaining: 1500, sessionDuration: 1500, deadline: null,
  currentTaskId: null, showPauseConfirm: false, completedPomodoros: 0, totalWorkTime: 0,
  todayPomodoros: 0, todayWorkTime: 0, lastResetDate: new Date().toDateString(), settings: DEFAULT_SETTINGS,
  start: () => {
    const state = get();
    if (state.status === 'running') return;
    set({ ...dailyStats(state), status: 'running', deadline: Date.now() + state.timeRemaining * 1000, showPauseConfirm: false });
  },
  pause: () => {
    if (get().status !== 'running') return;
    get().tick();
    const state = get();
    if (state.status === 'running') set({ status: 'paused', deadline: null, showPauseConfirm: !!state.currentTaskId });
  },
  resume: () => get().start(),
  confirmPause: () => set({ showPauseConfirm: false }),
  dismissPauseConfirm: () => set({ showPauseConfirm: false }),
  reset: () => {
    const seconds = duration('work', get().settings);
    set({ status: 'idle', phase: 'work', timeRemaining: seconds, sessionDuration: seconds, deadline: null, showPauseConfirm: false });
  },
  skip: () => {
    const state = get();
    const phase = state.phase === 'work' ? 'shortBreak' : 'work';
    const seconds = duration(phase, state.settings);
    set({ phase, timeRemaining: seconds, sessionDuration: seconds, status: 'idle', deadline: null, showPauseConfirm: false });
  },
  tick: () => {
    let state = get();
    const daily = dailyStats(state);
    if (Object.keys(daily).length) { set(daily); state = get(); }
    if (state.status !== 'running' || state.deadline === null) return;
    const remaining = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    if (remaining > 0) { if (remaining !== state.timeRemaining) set({ timeRemaining: remaining }); return; }
    const completedWork = state.phase === 'work';
    const count = state.completedPomodoros + (completedWork ? 1 : 0);
    const phase: PomodoroPhase = !completedWork ? 'work' : count % state.settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    const seconds = duration(phase, state.settings);
    const autoStart = phase === 'work' ? state.settings.autoStartWork : state.settings.autoStartBreaks;
    // On wake, finish the elapsed phase once; don't invent unattended work sessions.
    set({
      phase, timeRemaining: seconds, sessionDuration: seconds,
      status: autoStart ? 'running' : 'idle', deadline: autoStart ? Date.now() + seconds * 1000 : null,
      completedPomodoros: count, totalWorkTime: state.totalWorkTime + (completedWork ? state.sessionDuration : 0),
      todayPomodoros: state.todayPomodoros + (completedWork ? 1 : 0),
      todayWorkTime: state.todayWorkTime + (completedWork ? state.sessionDuration : 0),
    });
    notify(completedWork ? '工作时间结束！休息一下吧。' : '休息结束！开始新的工作吧。');
  },
  setTaskId: currentTaskId => set({ currentTaskId }),
  updateSettings: input => {
    const state = get(), settings = normalizeSettings({ ...state.settings, ...input });
    const seconds = duration(state.phase, settings);
    set({ settings, ...(state.status === 'idle' ? { timeRemaining: seconds, sessionDuration: seconds } : {}) });
  },
}), {
  name: 'dolist-pomodoro-storage',
  storage: createJSONStorage(() => ({
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => { if (localStorage.getItem(key) !== value) localStorage.setItem(key, value); },
    removeItem: key => localStorage.removeItem(key),
  })),
  partialize: state => ({
    completedPomodoros: state.completedPomodoros, totalWorkTime: state.totalWorkTime,
    todayPomodoros: state.todayPomodoros, todayWorkTime: state.todayWorkTime,
    lastResetDate: state.lastResetDate, settings: state.settings,
  }),
  merge: (persisted, current) => {
    const saved = persisted as Partial<PomodoroState>;
    const settings = normalizeSettings(saved.settings ?? {});
    const state = { ...current, ...saved, settings, timeRemaining: duration('work', settings), sessionDuration: duration('work', settings) };
    return { ...state, ...dailyStats(state) };
  },
}));
