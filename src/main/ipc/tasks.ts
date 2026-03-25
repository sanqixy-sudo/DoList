import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import type { CreateTaskAttachmentDto, CreateTaskDto, UpdateTaskDto } from '../../../types/models';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { TaskFilter } from '../../../types/ipc';
import { taskRepo } from '../db/repositories';

export function registerTaskHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TASKS_LIST, (_, filter?: TaskFilter) => {
    return taskRepo.findAll(filter);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_GET, (_, id: string) => {
    return taskRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_CREATE, (_, data: CreateTaskDto) => {
    return taskRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_UPDATE, (_, id: string, data: UpdateTaskDto) => {
    return taskRepo.update(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_DELETE, (_, id: string) => {
    taskRepo.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_SEARCH, (_, query: string) => {
    return taskRepo.search(query);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_REORDER, (_, ids: string[]) => {
    taskRepo.reorder(ids);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_PICK_ATTACHMENTS, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: 'Select attachments',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled) {
      return [];
    }

    return result.filePaths.map<CreateTaskAttachmentDto>((filePath) => {
      const stat = fs.statSync(filePath);
      return {
        sourcePath: filePath,
        name: path.basename(filePath),
        fileSize: stat.size,
        mimeType: inferMimeType(filePath),
      };
    });
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_PASTE_CLIPBOARD_IMAGE, async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return null;
    }

    const pngBuffer = image.toPNG();
    const directory = getClipboardAttachmentStagingDirectory();
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const fileName = `clipboard-image-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.png`;
    const filePath = path.join(directory, fileName);
    fs.writeFileSync(filePath, pngBuffer);

    return {
      sourcePath: filePath,
      name: fileName,
      fileSize: pngBuffer.byteLength,
      mimeType: 'image/png',
    } satisfies CreateTaskAttachmentDto;
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_GET_ATTACHMENT_PREVIEW_URL, async (_, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const mimeType = inferMimeType(filePath) ?? 'application/octet-stream';
    const fileBuffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_ADD_ATTACHMENT, (_, taskId: string, data: CreateTaskAttachmentDto) => {
    return taskRepo.addAttachment(taskId, data);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_REMOVE_ATTACHMENT, (_, attachmentId: string) => {
    taskRepo.removeAttachment(attachmentId);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_OPEN_ATTACHMENT, async (_, filePath: string) => {
    await shell.openPath(filePath);
  });
}

function inferMimeType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  const mimeByExtension: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };

  return mimeByExtension[extension] ?? null;
}

function getClipboardAttachmentStagingDirectory(): string {
  return path.join(app.getPath('temp'), 'dolist-clipboard-attachments');
}
