import { safeIpc as ipcMain } from './validated-ipc';
import { recordUndo, undoTaskChange } from '../db/repositories/task-undo';
import { dbAll, dbGet } from '../db/client';
import { mapRowToTask } from '../db/repositories/task-hydration';
import { buildPlaceholders } from '../db/utils/task-logic';
import { app, BrowserWindow, clipboard, nativeImage, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import type { CreateTaskAttachmentDto, CreateTaskDto, UpdateTaskDto } from '../../../types/models';
import { IPC_CHANNELS } from '../../../types/ipc';
import type { TaskFilter } from '../../../types/ipc';
import { taskRepo } from '../db/repositories';

const selectedSources = new Set<string>();
function requireAttachmentPath(filePath: string) {
  if (typeof filePath !== 'string' || (!selectedSources.has(path.resolve(filePath)) && !dbGet('SELECT id FROM task_attachments WHERE file_path = ?', [filePath]))) {
    throw new Error('只能访问已选择或已关联的附件');
  }
}
export function registerTaskHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TASKS_TRASH_LIST, () => taskRepo.findTrash());
  ipcMain.handle(IPC_CHANNELS.TASKS_TRASH, (_, ids) => taskRepo.trash(ids));
  ipcMain.handle(IPC_CHANNELS.TASKS_RESTORE, (_, ids) => taskRepo.restore(ids));
  ipcMain.handle(IPC_CHANNELS.TASKS_PURGE, (_, ids) => taskRepo.purge(ids));
  ipcMain.handle(IPC_CHANNELS.TASKS_UNDO, (_, token) => undoTaskChange(token));
  ipcMain.handle(IPC_CHANNELS.TASKS_BULK_UPDATE, (_, ids: string[], data) => {
    // Validate in the repository before exposing any undo record.
    const before = Array.isArray(ids) && ids.length ? dbAll('SELECT * FROM tasks WHERE id IN (' + buildPlaceholders(ids.length) + ')', ids).map(mapRowToTask) : [];
    const tasks = taskRepo.bulkUpdate(ids, data);
    return { tasks, undo: recordUndo(before, tasks) };
  });
  ipcMain.handle(IPC_CHANNELS.TASKS_LIST, (_, filter?: TaskFilter) => {
    return taskRepo.findAll(filter);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_GET, (_, id: string) => {
    return taskRepo.findById(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_CREATE, (_, data: CreateTaskDto) => {
    data.attachments?.forEach(file => requireAttachmentPath(file.sourcePath));
    return taskRepo.create(data);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_UPDATE, (_, id: string, data: UpdateTaskDto) => {
    const before = taskRepo.findById(id);
    const task = taskRepo.update(id, data);
    return { task, undo: recordUndo(before ? [before] : [], [task]) };
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
      selectedSources.add(path.resolve(filePath));
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
    const items = await clipboard.read();
    const item = items.find(entry => entry.types.some(type => type.startsWith('image/')));
    if (!item) return null;
    const mime = item.types.find(type => type === 'image/png') ?? item.types.find(type => type.startsWith('image/'))!;
    const blob = await item.getType(mime) as Blob;
    if (blob.size > 32 * 1024 * 1024) throw new Error('粘贴图片超过 32 MiB');
    const image = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
    if (image.isEmpty()) return null;
    const pngBuffer = image.toPNG();
    const directory = getClipboardAttachmentStagingDirectory();
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const fileName = `clipboard-image-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.png`;
    const filePath = path.join(directory, fileName);
    fs.writeFileSync(filePath, pngBuffer);
    selectedSources.add(path.resolve(filePath));

    return {
      sourcePath: filePath,
      name: fileName,
      fileSize: pngBuffer.byteLength,
      mimeType: 'image/png',
    } satisfies CreateTaskAttachmentDto;
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_GET_ATTACHMENT_PREVIEW_URL, async (_, filePath: string) => {
    requireAttachmentPath(filePath);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const mimeType = inferMimeType(filePath);
    if (!mimeType?.startsWith('image/') || fs.statSync(filePath).size > 32 * 1024 * 1024) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_ADD_ATTACHMENT, (_, taskId: string, data: CreateTaskAttachmentDto) => {
    requireAttachmentPath(data.sourcePath);
    return taskRepo.addAttachment(taskId, data);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_REMOVE_ATTACHMENT, (_, attachmentId: string) => {
    taskRepo.removeAttachment(attachmentId);
  });

  ipcMain.handle(IPC_CHANNELS.TASKS_OPEN_ATTACHMENT, async (_, filePath: string) => {
    requireAttachmentPath(filePath);
    const error = await shell.openPath(filePath);
    if (error) throw new Error('无法打开附件：' + error);
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
