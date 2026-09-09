import { safeIpc as ipcMain } from './ipc/validated-ipc';
import { backupBusy, cancelBackup } from './backup/coordinator';
import { registerPersistenceHandlers } from './ipc/persistence';
import { registerBackupHandlers } from './ipc/backup';
import { app, BrowserWindow, nativeTheme, globalShortcut, shell, dialog, powerMonitor } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './db/client';
import { registerTaskHandlers } from './ipc/tasks';
import { registerListHandlers } from './ipc/lists';
import { registerTagHandlers } from './ipc/tags';
import { registerSubtaskHandlers } from './ipc/subtasks';
import { registerReminderHandlers } from './ipc/reminders';
import { registerProjectGroupHandlers } from './ipc/project-groups';
import { createTray, destroyTray } from './tray/tray';
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

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
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
    if (process.platform === 'win32') app.setAppUserModelId('com.dolist.desktop');
    // Initialize database
    try { await initDatabase(app.getPath('userData')); }
    catch (error) {
      dialog.showErrorBox('无法打开任务数据库', '数据库未能读取或保存，请检查磁盘空间和文件权限。原文件已保留。\n' + String(error));
      app.exit(1); return;
    }

    // Register IPC handlers
    registerPersistenceHandlers();
    registerBackupHandlers();
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
      const protocol = new URL(url).protocol;
      if (!['https:', 'http:', 'mailto:'].includes(protocol)) throw new Error('不支持的外部链接');
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
    // Preserve the user's existing login-item preference.

    // Start reminder scheduler
    startScheduler();
    powerMonitor.on('resume', () => {
      mainWindow?.webContents.send('app:resume');
    });
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
    destroyTray();
  });

  app.on('before-quit', (event) => {
    if (backupBusy()) { event.preventDefault(); cancelBackup(); mainWindow?.show(); return; }
    try { closeDatabase(); }
    catch (error) {
      event.preventDefault();
      mainWindow?.show();
      dialog.showErrorBox('尚有数据未保存', '已取消退出。请检查磁盘空间和文件权限，然后重试保存，或在设置中导出备份。\n' + String(error));
      return;
    }
    isQuitting = true;
    stopScheduler();
  });
}
