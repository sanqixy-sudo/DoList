import { Tray, Menu, nativeImage, BrowserWindow, app, type NativeImage } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../../types/ipc';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  const iconPath = path.join(__dirname, '../../resources/icon.ico');
  let icon: NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('DoList - 任务管理');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 DoList',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: '快速添加任务',
      accelerator: 'CmdOrCtrl+Alt+N',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send(IPC_CHANNELS.APP_QUICK_ADD);
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
