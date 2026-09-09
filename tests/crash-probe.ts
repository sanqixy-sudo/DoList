import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase, closeDatabase } from '../src/main/db/client';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
const [mode, directory] = process.argv.slice(2);
app.setPath('userData', directory);
app.whenReady().then(async () => {
  try {
    await initDatabase(app.getPath('userData'));
    if (mode === 'write') {
      const file = path.join(directory, 'crash-source.txt'); fs.writeFileSync(file, '附件也要保留');
      const task = taskRepo.create({ title: '强杀恢复验证', listId: 'inbox', plannedDate: '2026-09-09', attachments: [{ sourcePath: file, name: '附件.txt' }] });
      taskRepo.update(task.id, { notes: '已经成功返回的修改', dueDate: '2026-09-10T12:00:00+08:00' });
      console.log('COMMITTED');
      setInterval(() => {}, 1000);
    } else {
      const task = taskRepo.search('强杀恢复验证')[0];
      if (!task || task.notes !== '已经成功返回的修改' || task.dueDate !== '2026-09-10T04:00:00.000Z' || !fs.existsSync(task.attachments![0].filePath)) throw new Error('恢复内容不完整');
      closeDatabase(); console.log('RECOVERED'); app.exit(0);
    }
  } catch (error) { console.error(String(error)); app.exit(2); }
});
