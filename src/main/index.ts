import { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, shell } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './db/client';
import { registerTaskHandlers } from './ipc/tasks';
import { registerListHandlers } from './ipc/lists';
import { registerTagHandlers } from './ipc/tags';
import { registerSubtaskHandlers } from './ipc/subtasks';
import { registerReminderHandlers } from './ipc/reminders';
import { registerProjectGroupHandlers } from './ipc/project-groups';
import { createTray } from './tray/tray';
import { startScheduler, stopScheduler } from './scheduler';
import { IPC_CHANNELS } from '../../types/ipc';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff',
    icon: path.join(__dirname, '../../resources/icon.png'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
};

// Register global shortcuts
function registerGlobalShortcuts() {
  // Global shortcut to show/hide window
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Global shortcut for quick add
  globalShortcut.register('CommandOrControl+Alt+N', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send(IPC_CHANNELS.APP_QUICK_ADD);
    }
  });
}

// Setup auto launch on startup
function setupAutoLaunch() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: false, // Default to false, user can enable in settings
      path: app.getPath('exe'),
    });
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Initialize database
    await initDatabase();

    // Register IPC handlers
    registerTaskHandlers();
    registerListHandlers();
    registerProjectGroupHandlers();
    registerTagHandlers();
    registerSubtaskHandlers();
    registerReminderHandlers();

    // App-level IPC handlers
    ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
      return app.getVersion();
    });

    ipcMain.handle(IPC_CHANNELS.APP_GET_THEME, () => {
      return nativeTheme.themeSource;
    });

    const updateWindowAppearance = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff');
      }
    };

    ipcMain.handle(IPC_CHANNELS.APP_SET_THEME, (_, theme: 'light' | 'dark' | 'system') => {
      nativeTheme.themeSource = theme;
      updateWindowAppearance();
    });

    nativeTheme.on('updated', () => {
      updateWindowAppearance();
    });

    ipcMain.handle(IPC_CHANNELS.APP_WINDOW_MINIMIZE, () => {
      mainWindow?.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.APP_WINDOW_TOGGLE_MAXIMIZE, () => {
      if (!mainWindow) return;

      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return;
      }

      mainWindow.maximize();
    });

    ipcMain.handle(IPC_CHANNELS.APP_WINDOW_CLOSE, () => {
      mainWindow?.close();
    });

    ipcMain.handle(IPC_CHANNELS.APP_MINIMIZE_TO_TRAY, () => {
      mainWindow?.hide();
    });

    ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
      app.quit();
    });

    ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_, url: string) => {
      await shell.openExternal(url);
    });

    // Auto launch settings
    ipcMain.handle('app:getAutoLaunch', () => {
      return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('app:setAutoLaunch', (_, enabled: boolean) => {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe'),
      });
    });

    // Create window
    createWindow();

    // Create system tray
    createTray(mainWindow!);

    // Register global shortcuts
    registerGlobalShortcuts();

    // Setup auto launch
    setupAutoLaunch();

    // Start reminder scheduler
    startScheduler();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });

  app.on('will-quit', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    stopScheduler();
    closeDatabase();
  });
}
