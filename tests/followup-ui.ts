import { runBackupJob, cancelBackup, getBackupProgress } from '../src/main/backup/coordinator';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { app, dialog } from 'electron';
import { dbRunMany } from '../src/main/db/client';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
import { listRepo } from '../src/main/db/repositories/lists.repo';
export async function runFollowupUI({ window, evaluate, until, click, screenshot, outputs }: any) {
 const directory=path.resolve(app.getPath('userData'));
 // This module must never run against the user's actual database or attachment directory.
 assert.equal(path.dirname(directory),path.resolve(process.cwd(),'.audit'));
 assert.ok(path.basename(directory).startsWith('ui-data-'));
 const today=new Date().toLocaleDateString('sv-SE');
 const project=listRepo.create({name:'一万项验证',groupId:'default-group'});
 dbRunMany('INSERT INTO tasks(id,list_id,title,planned_date,sort_order) VALUES(?,?,?,?,?)',Array.from({length:10000},(_,i)=>['audit-large-'+i,project.id,'大数据任务 '+String(i).padStart(5,'0'),today,i]));
 window.setSize(1280,850);window.webContents.reload();
 await until("document.body.textContent.includes('一万项验证')");
 await click('一万项验证');await click('时间线');
 await until("document.querySelectorAll('.timeline-entry').length === 40");
 assert.ok(await evaluate("document.querySelector('[aria-label=时间线分页]').textContent.includes('10000 条')"));
 await click('时间线最后一页');await until("document.querySelector('[aria-label=时间线分页]').textContent.includes('250 / 250')");
 await screenshot('followup-timeline-10000');
 await click('更多工具');await click('回顾');
 await until("document.querySelectorAll('.report-event').length === 40");
 await click('项目事件最后一页');await until("document.querySelector('[aria-label=项目事件分页]').textContent.includes('250 / 250')");
 outputs.push({test:'10000-timeline-report-pagination-bounded-and-last-page',passed:true});
 await click('一万项验证');await click('列表');await until("!!document.querySelector('[data-task-id=audit-large-0]')");
 await evaluate("document.querySelector('[data-task-id=audit-large-0] .task-body').click()");
 await until("!!document.querySelector('[aria-label=任务标题]')");
 await evaluate("(()=>{const el=document.querySelector('[aria-label=任务标题]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'尚未提交的持久草稿');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
 assert.equal(taskRepo.findById('audit-large-0')?.title,'大数据任务 00000');
 window.webContents.reload();await until("!!document.querySelector('[data-task-id=audit-large-0]')");
 await evaluate("document.querySelector('[data-task-id=audit-large-0] .task-body').click()");
 await until("document.querySelector('[aria-label=任务标题]')?.value === '尚未提交的持久草稿'");
 await click('关闭任务详情');await until("document.querySelector('[data-task-id=audit-large-0] .task-title')?.textContent === '尚未提交的持久草稿'");
 outputs.push({test:'unsubmitted-draft-survives-renderer-reload-and-saves',passed:true});
 await evaluate("document.querySelector('[data-task-id=audit-large-0] .task-body').click()");
 await until("!!document.querySelector('[aria-label=任务标题]')");
 await evaluate("window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('dolist-text-drafts'))throw Error('Injected quota');return window.__storageSet.call(this,key,value)};void 0");
 try {
  await evaluate("(()=>{const el=document.querySelector('[aria-label=任务标题]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'磁盘暂存失败仍保留输入');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until("document.querySelector('.detail-panel').textContent.includes('草稿暂存失败')");
  assert.equal(await evaluate("document.querySelector('[aria-label=任务标题]').value"),'磁盘暂存失败仍保留输入');
 } finally { await evaluate("Storage.prototype.setItem=window.__storageSet;delete window.__storageSet;void 0"); }
 await click('关闭任务详情');await until("document.querySelector('[data-task-id=audit-large-0] .task-title')?.textContent === '磁盘暂存失败仍保留输入'");
 outputs.push({test:'draft-quota-failure-keeps-input-and-shows-recovery',passed:true});

 for(const zoom of [1,1.25,1.5,2]){
  window.setSize(1280,850);window.webContents.setZoomFactor(zoom);await new Promise(r=>setTimeout(r,150));
  await click('添加任务');await until("!!document.querySelector('.quick-dialog [aria-label=新任务标题]')");
  const b=await evaluate("({width:innerWidth,height:innerHeight,rect:document.querySelector('.quick-dialog').getBoundingClientRect().toJSON()})");
  assert.ok(b.rect.left>=-1&&b.rect.right<=b.width+1&&b.rect.bottom<=b.height+1,JSON.stringify({zoom,b}));
  await click('取消');await until("!document.querySelector('.quick-dialog')");
 }
 window.webContents.setZoomFactor(1);
 window.webContents.debugger.attach('1.3');
 const tree=await window.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
 const controls=tree.nodes.filter((n:any)=>!n.ignored&&n.role?.value==='button'),unnamed=controls.filter((n:any)=>!n.name?.value);
 fs.writeFileSync(path.join(process.cwd(),'.audit/accessibility-results.json'),JSON.stringify({buttonCount:controls.length,unnamed:unnamed.map((n:any)=>n.nodeId)},null,2));
 assert.equal(unnamed.length,0);window.webContents.debugger.detach();
 outputs.push({test:'100-to-200-percent-zoom-and-accessibility-tree',passed:true,buttons:controls.length});
 const source=path.join(directory,'large-backup-source.bin');fs.writeFileSync(source,randomBytes(64*1024*1024));
 const task=taskRepo.create({title:'大备份附件',listId:'inbox',attachments:[{sourcePath:source,name:'大文件.bin'}]});
 const destination=path.join(directory,'large-canceled.dolist-backup'),save=dialog.showSaveDialog;
 (dialog as any).showSaveDialog=async()=>({canceled:false,filePath:destination});
 try{
  await click('设置');await until("!!document.querySelector('.settings-dialog')");
  await evaluate("window.__backupFrames=0;window.__backupActive=true;function count(){window.__backupFrames++;if(window.__backupActive)requestAnimationFrame(count)}requestAnimationFrame(count);void 0");
  await click('导出完整备份');await until("document.querySelector('.backup-progress')?.textContent.includes('压缩备份')");
  const start=performance.now();await evaluate("window.__backupFrames");const roundTrip=performance.now()-start;
  assert.equal(await evaluate("window.electronAPI.tasks.update('audit-large-1',{title:'不应写入'}).then(()=>false).catch(()=>true)"),true);
  await click('取消当前操作');await until("document.querySelector('.backup-settings [role=alert]')?.textContent.includes('已取消')");
  assert.equal(fs.existsSync(destination),false);assert.ok(taskRepo.findById(task.id));
  const frames=await evaluate("window.__backupActive=false;window.__backupFrames");assert.ok(frames>10);assert.ok(roundTrip<500);
  await click('导出完整备份');await until("document.querySelector('.backup-result')?.textContent.includes('已导出完整备份')");
  assert.ok(fs.statSync(destination).size>60*1024*1024);await screenshot('followup-backup-result');
  const preview = await runBackupJob('preview', {file:destination});
  const sentinel = taskRepo.create({title:'取消恢复必须保留',listId:'inbox'});
  const restoring = runBackupJob('restore', {file:destination,fingerprint:preview.fingerprint}).then(()=>false, error=>String(error).includes('已取消'));
  const deadline = Date.now()+30000;
  while(getBackupProgress()?.phase !== '压缩备份' && Date.now()<deadline) await new Promise(r=>setTimeout(r,10));
  assert.equal(getBackupProgress()?.phase,'压缩备份');cancelBackup();
  assert.equal(await restoring,true);assert.ok(taskRepo.findById(sentinel.id));
  assert.equal(fs.readdirSync(path.join(directory,'backup-jobs')).length,0);
  outputs.push({test:'64MiB-restore-cancel-keeps-new-data-and-removes-staging',passed:true});

  const orphan=path.join(directory,'attachments','unused-ui.txt');fs.writeFileSync(orphan,'可以清理');
  await click('扫描未引用文件');await until("document.querySelector('[aria-label=附件空间清理]').textContent.includes('可清理')");
  await click('清理未引用文件');await until("document.querySelector('[aria-label=附件空间清理]').textContent.includes('已清理')");
  assert.equal(fs.existsSync(orphan),false);assert.ok(fs.existsSync(task.attachments![0].filePath));
  outputs.push({test:'64MiB-backup-responsive-cancel-retry-lock-and-cleanup',passed:true,frames,roundTripMs:roundTrip});
  await evaluate("document.querySelector('.settings-dialog button.absolute').click()");
 }finally{dialog.showSaveDialog=save;}
}
