import { registerPersistenceHandlers } from '../src/main/ipc/persistence';
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../src/main/db/client';
import { registerTaskHandlers } from '../src/main/ipc/tasks';
import { registerListHandlers } from '../src/main/ipc/lists';
import { registerProjectGroupHandlers } from '../src/main/ipc/project-groups';
import { registerSubtaskHandlers } from '../src/main/ipc/subtasks';
import { registerReminderHandlers } from '../src/main/ipc/reminders';
import { registerTagHandlers } from '../src/main/ipc/tags';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
const root = process.cwd();
app.setPath('userData', fs.mkdtempSync(path.join(root, '.audit/benchmark-data-')));
app.commandLine.appendSwitch('disable-gpu');
const label = process.argv[2] || 'current';
const count = 3000;
const watchdog = setTimeout(() => app.exit(1), 120000);
app.whenReady().then(async () => {
 let win: BrowserWindow | null = null;
 try {
  await initDatabase(app.getPath('userData'));
  const db = getDatabase(), day = new Date().toLocaleDateString('sv-SE');
  db.run('BEGIN TRANSACTION');
  const insert = db.prepare('INSERT INTO tasks (id,list_id,title,notes,planned_date,sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  for(let i=0; i<count; i++) insert.run(['load-'+i,'inbox','性能测试任务 '+String(i).padStart(4,'0'),'测试备注 '.repeat(30),day,i]);
  insert.free(); db.run('COMMIT');
  const reads: number[] = [], reorders: number[] = [];
  for(let i=0;i<5;i++) { const start=performance.now(); taskRepo.findAll({status:'all'}); reads.push(performance.now()-start); }
  const ids=Array.from({length:count},(_,i)=>'load-'+i);
  for(let i=0;i<5;i++) { const start=performance.now(); taskRepo.reorder(i%2 ? ids : [...ids].reverse()); reorders.push(performance.now()-start); }
  taskRepo.reorder(ids);
  registerPersistenceHandlers();registerTaskHandlers();registerListHandlers();registerProjectGroupHandlers();registerSubtaskHandlers();registerReminderHandlers();registerTagHandlers();
  ipcMain.handle('app:getVersion',()=> 'test');
  ipcMain.handle('app:setTheme',()=> {});
  win = new BrowserWindow({show:false,width:1280,height:850,webPreferences:{preload:path.join(root,'dist/preload/index.js'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
  const errors: string[]=[];
  win.webContents.on('console-message',event=>{if(event.level==='error') errors.push(event.message)});
  const results=[];
  for(let run=0;run<3;run++) {
   const start=performance.now();
   await win.loadFile(path.join(root,'dist/renderer/index.html'));
   for(let i=0;i<600;i++) {
    if(await win.webContents.executeJavaScript("!!document.querySelector('[data-task-id]')")) break;
    await new Promise(r=>setTimeout(r,50));
   }
   await win.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   const readyMs=performance.now()-start;
   const mounted=await win.webContents.executeJavaScript("document.querySelectorAll('[data-task-id]').length");
   const scroll=await win.webContents.executeJavaScript(`(async()=>{const scroller=document.querySelector('.task-workspace');const start=performance.now(); scroller.scrollTop=scroller.scrollHeight;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {ms:performance.now()-start,mounted:document.querySelectorAll('[data-task-id]').length, lastVisible:!!document.querySelector('[data-task-id="load-2999"]')};})()`);
   results.push({readyMs,mounted,scroll});
  }
  fs.writeFileSync(path.join(root,'.audit/benchmark-'+label+'.json'),JSON.stringify({label,count,reads,reorders,results,errors},null,2));
  console.log(JSON.stringify({label,count,reads,reorders,results,errors},null,2));
  closeDatabase(); win.destroy();clearTimeout(watchdog);app.exit(errors.length ? 1 : 0);
 } catch(error) { console.error(error); closeDatabase();win?.destroy();clearTimeout(watchdog);app.exit(1); }
});
