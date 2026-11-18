import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { randomUUID as uuidv4 } from 'node:crypto';
import { dbRun, dbGet, dbDurableTransaction } from '../client';
import { requireActiveTask } from './task-guard';
import type { TaskAttachment, CreateTaskAttachmentDto } from '../../../../types/models';
export const taskAttachmentRepo = {
  addAttachment(taskId: string, data: CreateTaskAttachmentDto): TaskAttachment {
    requireActiveTask(taskId);
    return importAttachment(taskId, data);
  },

  removeAttachment(id: string): void {
    const attachment = dbGet('SELECT * FROM task_attachments WHERE id = ?', [id]);
    if (!attachment) return;
    requireActiveTask(attachment.task_id);

    dbDurableTransaction(() => dbRun('DELETE FROM task_attachments WHERE id = ?', [id]));
    removeAttachmentFile(attachment.file_path);
  },
};
export function importAttachment(taskId: string, data: CreateTaskAttachmentDto, cleanupSource = true): TaskAttachment {
  if (!fs.existsSync(data.sourcePath)) {
    throw new Error(`Attachment source file not found: ${data.sourcePath}`);
  }

  ensureAttachmentDirectory();

  const attachmentId = uuidv4();
  const sourceExtension = path.extname(data.sourcePath);
  const storedName = `${taskId}-${attachmentId}${sourceExtension}`;
  const filePath = path.join(getAttachmentDirectory(), storedName);
  const stat = fs.statSync(data.sourcePath);
  if (!stat.isFile()) throw new Error('附件必须是文件');
  const fileSize = stat.size;
  const mimeType = data.mimeType ?? inferMimeType(data.sourcePath);
  const now = new Date().toISOString();

  fs.copyFileSync(data.sourcePath, filePath);
  try {
  dbRun(
    `INSERT INTO task_attachments (id, task_id, name, stored_name, file_path, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [attachmentId, taskId, data.name, storedName, filePath, mimeType, fileSize, now]
  );

  } catch (error) {
    removeAttachmentFile(filePath);
    throw error;
  }
  if (cleanupSource) cleanupImportedSourcePath(data.sourcePath);
  return {
    id: attachmentId,
    taskId,
    name: data.name,
    storedName,
    filePath,
    mimeType,
    fileSize,
    createdAt: now,
  };
}

function getAttachmentDirectory(): string {
  return path.join(app.getPath('userData'), 'attachments');
}

function ensureAttachmentDirectory(): void {
  const attachmentDirectory = getAttachmentDirectory();
  if (!fs.existsSync(attachmentDirectory)) {
    fs.mkdirSync(attachmentDirectory, { recursive: true });
  }
}

export function getClipboardAttachmentStagingDirectory(): string {
  return path.join(app.getPath('temp'), 'dolist-clipboard-attachments');
}

export function cleanupImportedSourcePath(sourcePath: string): void {
  const stagingDirectory = getClipboardAttachmentStagingDirectory();
  const relativePath = path.relative(stagingDirectory, sourcePath);
  if (!relativePath || relativePath === '..' || path.basename(relativePath) !== relativePath) return;
  try {
    if (fs.lstatSync(stagingDirectory, { throwIfNoEntry: false })?.isDirectory()) {
      removeAttachmentFile(sourcePath);
    }
  } catch (error) {
    console.error('Failed to verify clipboard attachment staging directory:', error);
  }
}

export function removeAttachmentFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to remove attachment file:', error);
  }
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
