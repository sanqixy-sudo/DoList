import { runFollowupUI } from './followup-ui';
import { runFullAuditUI } from './full-audit-ui';
import { registerPersistenceHandlers } from '../src/main/ipc/persistence';
import { registerBackupHandlers } from '../src/main/ipc/backup';
import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { initDatabase, closeDatabase, dbRunMany } from '../src/main/db/client';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
import { listRepo } from '../src/main/db/repositories/lists.repo';
import { registerTaskHandlers } from '../src/main/ipc/tasks';
import { registerListHandlers } from '../src/main/ipc/lists';
import { registerProjectGroupHandlers } from '../src/main/ipc/project-groups';
import { registerSubtaskHandlers } from '../src/main/ipc/subtasks';
import { registerReminderHandlers } from '../src/main/ipc/reminders';
import { registerTagHandlers } from '../src/main/ipc/tags';
const root = process.cwd();
for (const name of ['ui-error.txt', 'ui-results.json']) { const file = path.join(root, '.audit', name); if (fs.existsSync(file)) fs.unlinkSync(file); }
const data = fs.mkdtempSync(path.join(root, '.audit/ui-data-'));
app.setPath('userData', data);
app.commandLine.appendSwitch('disable-gpu');
let window: BrowserWindow;
const outputs: any[] = [];
const deadline = setTimeout(() => { console.error('Smoke timeout'); app.exit(1); }, 240000);
async function evaluate(code: string) { try { return await window.webContents.executeJavaScript(code, true); } catch (e) { throw new Error(code + '\n' + String(e) + '\n' + JSON.stringify(outputs)); } }
async function until(code: string) {
  for (let i = 0; i < 150; i++) { if (await evaluate(code)) return; await new Promise(r => setTimeout(r, 40)); }
  throw new Error('Condition not reached: ' + code + '\n' + await evaluate("document.body.innerText") + '\n' + JSON.stringify(outputs));
}
async function click(text: string) {
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => (b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)})); if (!button) throw new Error('Button missing: ' + ${JSON.stringify(text)}); button.click(); })()`);
}
async function screenshot(name: string) {
  await new Promise(r => setTimeout(r, 450));
  await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  fs.writeFileSync(path.join(root, '.audit/' + name + '.png'), (await window.webContents.capturePage()).toPNG());
}
app.whenReady().then(async () => {
  try {
    await initDatabase(app.getPath('userData'));
    registerPersistenceHandlers(); registerBackupHandlers(); registerTaskHandlers(); registerListHandlers(); registerProjectGroupHandlers(); registerSubtaskHandlers(); registerReminderHandlers(); registerTagHandlers();
    ipcMain.handle('app:getVersion', () => '1.0.2-preview');
    ipcMain.handle('app:setTheme', (_event, value) => { nativeTheme.themeSource = value; });
    ipcMain.handle('app:getTheme', () => 'light');
    for (const channel of ['app:windowMinimize', 'app:windowToggleMaximize', 'app:windowClose', 'app:openExternal']) ipcMain.handle(channel, () => {});
    const project = listRepo.create({ name: 'DoList 改版', color: '#347ec4', groupId: 'default-group' });
    const date = new Date(); const today = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
    taskRepo.create({ title: '梳理今天最重要的三件事', listId: 'inbox', plannedDate: today, priority: 3 });
    const planned = taskRepo.create({ title: '完成新版任务页的布局与交互', listId: project.id, plannedDate: today, dueDate: new Date(Date.now()+86400000*3).toISOString(), priority: 2, notes: '统一任务行、详情面板和快速添加。' });
    taskRepo.create({ title: '阅读 20 分钟，记下一个新想法', listId: 'inbox', plannedDate: today });
    taskRepo.create({ title: '整理上周留下的笔记', listId: 'inbox', plannedDate: '2026-01-01' });
    const done = taskRepo.create({ title: '为今天留出一段专注时间', listId: 'inbox', plannedDate: today }); taskRepo.update(done.id,{ status:'done' });
    for (const [offset, title] of [[1, '整理读书笔记'], [3, '完善项目交互细节'], [10, '回顾本月进度']] as const) {
      const day = new Date(); day.setDate(day.getDate() + offset);
      taskRepo.create({ title, listId: project.id, plannedDate: day.toLocaleDateString('sv-SE') });
    }
    for (let i=0;i<5;i++) taskRepo.create({title:'日历安排 '+i,listId:project.id,plannedDate:today});
    window = new BrowserWindow({ show:false, width:1280, height:850, webPreferences:{ preload:path.join(root,'dist/preload/index.js'), contextIsolation:true, nodeIntegration:false, backgroundThrottling:false, offscreen:true } });
    window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
    window.webContents.on('console-message', event => { if (['warning','error'].includes(event.level)) outputs.push({type:'console',level:event.level,message:event.message}); });
    window.webContents.on('render-process-gone', (_event, details) => { throw new Error(JSON.stringify(details)); });
    await window.loadFile(path.join(root,'dist/renderer/index.html'));
    await until("document.querySelectorAll('[data-task-id]').length >= 4");
    await screenshot('today-light');
    await evaluate(`document.querySelector('[data-task-id="${planned.id}"] .task-body').click()`);
    await until("document.querySelector('.detail-panel textarea') !== null");
    await screenshot('today-detail');
    await evaluate(`(() => { const input = document.querySelector('[aria-label="任务标题"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'完成新版任务页的布局与交互（已校对）'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await evaluate("document.querySelector('[aria-label=任务标题]').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))");
    await until(`document.querySelector('[data-task-id="${planned.id}"] .task-title').textContent.includes('已校对')`);
    assert.ok(taskRepo.findById(planned.id)?.title.includes('已校对'));
    await evaluate(`(() => { const input = document.querySelector('.detail-panel input[type=date]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,''); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await until("document.querySelector('.detail-panel input[type=date]').value === ''");
    await new Promise(r => setTimeout(r, 80));
    assert.equal(taskRepo.findById(planned.id)?.plannedDate,null);
    assert.equal(taskRepo.findById(planned.id)?.dueDate,planned.dueDate);
    await click('安排到今天');
    await until(`document.querySelector('.detail-panel input[type=date]').value === '${today}'`);
    outputs.push({test:'detail-save-and-independent-plan',passed:true});
    assert.equal(await evaluate("document.querySelector('input[type=date]').value"), today);
    await evaluate("document.querySelector('[aria-label=关闭任务详情]').click()");
    await click('添加任务');
    await until("document.querySelector('[aria-label=新任务标题]') !== null");
    await evaluate(`(() => { const input = document.querySelector('[aria-label=新任务标题]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'测试快速创建'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await evaluate("document.querySelector('.quick-dialog form').requestSubmit()");
    await until("!document.querySelector('.quick-dialog')");
    await until("document.body.textContent.includes('测试快速创建')");
    const created = taskRepo.search('测试快速创建')[0]; assert.equal(created.plannedDate,today); assert.equal(created.dueDate,null);
    outputs.push({ test:'quick-create-and-plan', passed:true });
    await evaluate(`document.querySelector('[data-task-id="${created.id}"] [role=checkbox]').click()`);
    await until(`!document.querySelector('[data-task-id="${created.id}"]')`);
    assert.equal(taskRepo.findById(created.id)?.status,'done');
    outputs.push({test:'complete-task',passed:true});
    await click('DoList 改版'); await click('看板');
    await until("document.body.textContent.includes('已取消')");
    assert.equal(await evaluate("document.body.textContent.includes('阅读 20 分钟，记下一个新想法')"), false);
    outputs.push({ test:'project-scope-preserved-in-kanban', passed:true });
    await evaluate("[...document.querySelectorAll('.app-sidebar .nav-item')].find(b => b.querySelector('span')?.textContent === '今天').click()");
    await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('深色'); await evaluate("document.querySelector('.settings-dialog button.absolute').click()"); await until("document.documentElement.classList.contains('dark')"); await screenshot('today-dark');
    window.setSize(800,600); await evaluate(`document.querySelector('[data-task-id="${planned.id}"] .task-body').click()`);
    await until("document.querySelector('.detail-dialog') !== null"); await screenshot('today-compact');
    const bounds = await evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector('.detail-dialog').getBoundingClientRect().toJSON()})");
    assert.ok(bounds.dialog.left >= 0 && bounds.dialog.right <= bounds.viewport);
    outputs.push({test:'compact-detail-layout',passed:true,bounds});
    await evaluate("document.querySelector('[aria-label=关闭任务详情]').click()");
    await until("!document.querySelector('.detail-dialog')");
    outputs.push({test:'compact-detail-close',passed:true});


    // Third-round board and calendar checks.
    window.setSize(1280,850);
    await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('浅色'); await evaluate("document.querySelector('.settings-dialog button.absolute').click()");
    await click('DoList 改版'); await click('看板');
    const setValue = (selector: string, value: string, input = false) => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(${input}) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});else el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('${input ? 'input' : 'change'}',{bubbles:true}));})()`);
    const cardIn = (status: string) => `!!document.querySelector('[data-board-column="${status}"] [data-card-id="${planned.id}"]')`;
    const statusSelector = '[data-card-id="' + planned.id + '"] select';
    await until(cardIn('todo')); await screenshot('board-light');
    await setValue(statusSelector,'done'); await until(cardIn('done'));
    assert.equal(taskRepo.findById(planned.id)?.dueDate,planned.dueDate);
    await click('撤销'); await until(cardIn('todo'));
    const points = await evaluate(`(() => {const a=document.querySelector('[data-card-id="${planned.id}"] .board-drag-handle').getBoundingClientRect();const b=document.querySelector('[data-board-column=canceled]').getBoundingClientRect();return {x:Math.round(a.x+a.width/2),y:Math.round(a.y+a.height/2),tx:Math.round(b.x+b.width/2),ty:Math.round(b.y+80)};})()`);
    window.webContents.sendInputEvent({type:'mouseMove',x:points.x,y:points.y});
    window.webContents.sendInputEvent({type:'mouseDown',x:points.x,y:points.y,button:'left',clickCount:1});
    window.webContents.sendInputEvent({type:'mouseMove',x:points.x+10,y:points.y});
    await new Promise(r=>setTimeout(r,70));
    window.webContents.sendInputEvent({type:'mouseMove',x:points.tx,y:points.ty});
    await new Promise(r=>setTimeout(r,100));
    window.webContents.sendInputEvent({type:'mouseUp',x:points.tx,y:points.ty,button:'left',clickCount:1});
    await until(cardIn('canceled')); await screenshot('board-moved');
    await click('撤销'); await until(cardIn('todo'));
    outputs.push({test:'board-status-drag-and-undo',passed:true});
    const originalUpdate=taskRepo.update;
    taskRepo.update=function(id,data){if(id===planned.id) throw new Error('Injected update failure');return originalUpdate.call(this,id,data);};
    try {await setValue(statusSelector,'done');await until("document.body.textContent.includes('状态未能更新')");assert.equal(taskRepo.findById(planned.id)?.status,'todo');}
    finally {taskRepo.update=originalUpdate;}
    await click('关闭提示');await setValue(statusSelector,'done');await until(cardIn('done'));await click('撤销');await until(cardIn('todo'));
    outputs.push({test:'board-failure-and-retry',passed:true});
    await setValue('[aria-label=筛选当前看板任务]','不会匹配的关键词',true);await until("document.querySelectorAll('.task-card').length === 0");
    await click('清除看板筛选');await until("document.querySelectorAll('.task-card').length > 0");
    outputs.push({test:'board-filter-and-empty-state',passed:true});
    await click('日历');
    await until(`!!document.querySelector('[data-calendar-day="${today}"] .calendar-more')`);
    await screenshot('calendar-month');
    await evaluate(`document.querySelector('[data-calendar-day="${today}"] .calendar-more').click()`);
    await until("!!document.querySelector('.calendar-agenda-dialog .task-card')");
    assert.ok(await evaluate("Number(document.querySelector('.calendar-agenda-dialog [aria-setsize]').getAttribute('aria-setsize')) >= 6"));
    await screenshot('calendar-agenda');
    await evaluate("document.querySelector('.calendar-agenda-dialog .task-card-open').click()");
    await until("!document.querySelector('.calendar-agenda-dialog') && !!document.querySelector('.detail-panel')");
    await evaluate("document.querySelector('[aria-label=关闭任务详情]').click()");
    outputs.push({test:'calendar-overflow-opens-all-and-common-detail',passed:true});
    for(const [view,columns] of [['day',1],['multiDay',3],['week',7],['multiWeek',14],['month',0]] as const){
      await setValue('[aria-label=日历展示范围]',view);
      if(view==='month'||view==='multiWeek'){
        await until("!!document.querySelector('.calendar-month-grid')");
        if(view==='multiWeek') assert.equal(await evaluate("document.querySelectorAll('[data-calendar-day]').length"),14);
      }else{
        await until(`document.querySelectorAll('.calendar-time-heading > button').length === ${columns}`);
        assert.equal(await evaluate(`!!document.querySelector('[data-hour="0"] [data-calendar-task="${planned.id}"]')`),false);
        if(view==='week') await screenshot('calendar-week');
      }
    }
    outputs.push({test:'calendar-five-ranges-and-all-day-deduplication',passed:true});
    const chosenDay=await evaluate(`[...document.querySelectorAll('[data-calendar-day]')].find(el=>el.dataset.calendarDay!=='${today}').dataset.calendarDay`);
    await evaluate(`document.querySelector('[data-calendar-day="${chosenDay}"] .calendar-add-day').click()`);
    await until("!!document.querySelector('[aria-label=新任务标题]')");
    assert.equal(await evaluate("document.querySelector('[aria-label=新任务计划日期]').value"),chosenDay);
    await setValue('[aria-label=新任务标题]','从日历安排任务',true);
    await evaluate("document.querySelector('.quick-dialog form').requestSubmit()");
    await until("!document.querySelector('.quick-dialog')");
    const fromCalendar=taskRepo.search('从日历安排任务')[0];
    assert.equal(fromCalendar.plannedDate,chosenDay);assert.equal(fromCalendar.dueDate,null);assert.equal(fromCalendar.listId,project.id);
    outputs.push({test:'calendar-add-preserves-chosen-date-and-project',passed:true});
    await click('设置');await click('深色');await click('关闭');await screenshot('calendar-dark');
    window.setSize(800,600);await screenshot('calendar-compact');
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    await click('看板');await until("!!document.querySelector('.board-columns')");
    const boundsBoard=await evaluate("({root:document.documentElement.scrollWidth,width:innerWidth,board:document.querySelector('.board-columns').scrollWidth,visible:document.querySelector('.board-columns').clientWidth})");
    assert.ok(boundsBoard.root<=boundsBoard.width && boundsBoard.board>boundsBoard.visible);
    await screenshot('board-compact');
    outputs.push({test:'calendar-and-board-compact-overflow-contained',passed:true});
    await click('列表');

    // Large-list checks use a separate project and never touch personal data.
    window.setSize(1280, 850);
    await click('计划');
    await until("document.querySelector('[role=list][aria-label=明天]') !== null");
    await evaluate("[...document.querySelectorAll('.section-label')].find(b=>b.textContent.startsWith('今天')).click()");
    await screenshot('plan-overview');
    const largeProject = listRepo.create({ name: '大列表验证', groupId: 'default-group' });
    dbRunMany(
      'INSERT INTO tasks (id,list_id,title,planned_date,sort_order) VALUES (?,?,?,?,?)',
      Array.from({ length: 1500 }, (_, index) => ['virtual-' + index, largeProject.id, '任务 ' + String(index).padStart(4, '0'), today, index]),
    );
    await window.loadFile(path.join(root, 'dist/renderer/index.html'));
    await until("document.querySelectorAll('[data-task-id]').length > 0");
    await click('大列表验证');
    await until("document.querySelector('[data-task-id=\"virtual-0\"]') !== null");
    const initialMounted = await evaluate("document.querySelectorAll('[data-task-id]').length");
    assert.ok(initialMounted < 60, 'Initial mounted rows: ' + initialMounted);
    const dragPoints = await evaluate(`(() => {
      const a = document.querySelector('[data-task-id="virtual-0"] .task-drag').getBoundingClientRect();
      const b = document.querySelector('[data-task-id="virtual-2"] .task-drag').getBoundingClientRect();
      return { x: Math.round(a.x + a.width / 2), from: Math.round(a.y + a.height / 2), to: Math.round(b.y + b.height / 2) };
    })()`);
    window.webContents.sendInputEvent({ type: 'mouseMove', x: dragPoints.x, y: dragPoints.from });
    window.webContents.sendInputEvent({ type: 'mouseDown', x: dragPoints.x, y: dragPoints.from, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: dragPoints.x, y: dragPoints.from + 12 });
    await new Promise(r => setTimeout(r, 80));
    window.webContents.sendInputEvent({ type: 'mouseMove', x: dragPoints.x, y: dragPoints.to });
    await new Promise(r => setTimeout(r, 120));
    window.webContents.sendInputEvent({ type: 'mouseUp', x: dragPoints.x, y: dragPoints.to, button: 'left', clickCount: 1 });
    await until("document.querySelector('[data-task-id=\"virtual-0\"]').parentElement.getAttribute('aria-posinset') === '3'");
    outputs.push({ test: 'virtual-list-pointer-drag', passed: true });

    await evaluate("document.querySelector('.task-workspace').scrollTop = document.querySelector('.task-workspace').scrollHeight");
    await until("document.querySelector('[data-task-id=\"virtual-1499\"]') !== null");
    await evaluate("document.querySelector('[data-task-id=\"virtual-1499\"] .task-body').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}))");
    await until("document.activeElement?.closest('[data-task-id]')?.dataset.taskId === 'virtual-1'");
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))");
    await until("document.activeElement?.closest('[data-task-id]')?.dataset.taskId === 'virtual-1499'");
    await evaluate("document.querySelector('[data-task-id=\"virtual-1499\"] .task-drag').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',altKey:true,bubbles:true}))");
    await until("document.querySelector('[data-task-id=\"virtual-1499\"]').parentElement.getAttribute('aria-posinset') === '1499'");
    assert.equal(taskRepo.findById('virtual-1499')?.sortOrder < taskRepo.findById('virtual-1498')!.sortOrder, true);
    await evaluate("document.querySelector('[data-task-id=\"virtual-1499\"] [role=checkbox]').click()");
    await until("!document.querySelector('[data-task-id=\"virtual-1499\"]')");
    assert.equal(taskRepo.findById('virtual-1499')?.status, 'done');
    assert.ok(await evaluate("document.querySelectorAll('[data-task-id]').length < 60"));
    outputs.push({ test: 'virtual-list-scroll-keyboard-reorder-complete', passed: true, totalTasks: 1500, initialMounted });

    await click('看板');
    await until("document.querySelector('[data-board-column=todo] .task-card') !== null");
    assert.ok(await evaluate("document.querySelectorAll('.task-card').length < 45"));
    await evaluate("(() => {const el=document.querySelector('[data-board-column=todo] .card-list-scroll');el.scrollTop=el.scrollHeight;})()");
    await until("document.querySelector('[data-card-id=\"virtual-1498\"]') !== null");
    outputs.push({test:'large-board-card-virtualization',passed:true});
    await click('日历');
    await until(`!!document.querySelector('[data-calendar-day="${today}"] .calendar-more')`);
    await evaluate(`document.querySelector('[data-calendar-day="${today}"] .calendar-more').click()`);
    await until("!!document.querySelector('.calendar-agenda-dialog .task-card')");
    assert.ok(await evaluate("document.querySelectorAll('.calendar-agenda-dialog .task-card').length < 25"));
    await evaluate("document.querySelector('.calendar-agenda-dialog .task-card-open').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))");
    await until("document.activeElement?.closest('[data-card-id]')?.dataset.cardId === 'virtual-1498'");
    await click('关闭'); await until("!document.querySelector('.calendar-agenda-dialog')");
    await click('列表');
    outputs.push({test:'large-calendar-agenda-keyboard-navigation',passed:true});

    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toLocaleDateString('sv-SE');
    dbRunMany(
      'INSERT INTO tasks (id,list_id,title,planned_date,sort_order) VALUES (?,?,?,?,?)',
      Array.from({ length: 100 }, (_, index) => ['past-' + index, largeProject.id, '待安排任务 ' + index, '2026-01-01', 2000 + index]),
    );
    taskRepo.create({ title: '明天整理读书笔记', listId: largeProject.id, plannedDate: tomorrow });
    await window.loadFile(path.join(root, 'dist/renderer/index.html'));
    await until("document.querySelectorAll('[data-task-id]').length > 0");
    await click('计划');
    await until("document.querySelector('[role=list][aria-label=明天]') !== null");
    await evaluate("[...document.querySelectorAll('.section-label')].find(b=>b.textContent.startsWith('待重新安排')).click()");
    await until("document.querySelector('[data-task-id=\"virtual-0\"]') !== null");
    const rowBounds = await evaluate("document.querySelector('[data-task-id=\"virtual-0\"]').getBoundingClientRect().toJSON()");
    assert.ok(rowBounds.top >= 0 && rowBounds.bottom <= 850);
    await evaluate("document.querySelector('.task-workspace').scrollTop = document.querySelector('.task-workspace').scrollHeight");
    await until("document.body.innerText.includes('明天整理读书笔记')");
    assert.equal(await evaluate("document.querySelector('[role=list][aria-label=明天] .task-drag') === null"), true);
    await screenshot('plan-grouped');
    outputs.push({ test: 'plan-date-groups-and-collapse-offset', passed: true });


    // Round four: a large selection includes unmounted rows and collapsed groups.
    await click('大列表验证');
    const originalCheckLeft = await evaluate("document.querySelector('.task-row .task-check').getBoundingClientRect().left");
    const firstSelectionId = await evaluate("document.querySelector('.task-row').dataset.taskId");
    const selectionStatus = taskRepo.findById(firstSelectionId)!.status;
    await click('批量整理');
    assert.ok(await evaluate("[...document.querySelectorAll('.task-row')].every(row=>row.querySelectorAll('input[type=checkbox], [role=checkbox]').length === 1 && !row.querySelector('.task-check'))"));
    assert.equal(await evaluate("document.querySelector('.batch-checkbox').getBoundingClientRect().left"), originalCheckLeft);
    await evaluate("document.querySelector('.task-selection').click()");
    await until("document.querySelector('.batch-heading strong').textContent === '已选 1 项'");
    await evaluate("document.querySelector('.task-row .task-body').click()");
    await until("document.querySelector('.batch-heading strong').textContent === '已选 0 项'");
    await evaluate("document.querySelector('.batch-checkbox').focus()");
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});
    window.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});
    await until("document.querySelector('.batch-checkbox').checked");
    assert.equal(taskRepo.findById(firstSelectionId)!.status, selectionStatus);
    await click('退出多选');
    assert.ok(await evaluate("!document.querySelector('.batch-checkbox') && !!document.querySelector('.task-row .task-check')"));
    assert.equal(await evaluate("document.querySelector('.task-row .task-check').getAttribute('aria-checked')"), 'false');
    outputs.push({test:'batch-single-checkbox-pointer-keyboard-does-not-complete',passed:true});
    await click('批量整理');
    await click('全选当前页面');
    await until("document.querySelector('.batch-heading').textContent.includes('已选 1601 项')");
    assert.ok(await evaluate("document.querySelectorAll('.batch-checkbox').length < 60"));
    assert.equal(await evaluate("document.querySelector('.task-drag') === null"), true);
    await screenshot('batch-large');
    await click('移入回收站');
    await until("document.querySelector('.trash-notice')?.textContent.includes('1601 项')");
    assert.equal(taskRepo.findAll({ listId: largeProject.id }).length, 0);
    assert.ok(taskRepo.findById(planned.id));
    await click('回收站');
    await until("document.querySelectorAll('.trash-card').length > 0");
    assert.ok(await evaluate("document.querySelectorAll('.trash-card').length < 20"));
    await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('浅色');
    await evaluate("document.querySelector('[role=dialog] button.absolute').click()");
    await until("!document.querySelector('[role=dialog]')");
    await screenshot('trash-light');
    await evaluate("document.querySelector('.trash-card .task-card-open').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))");
    await until("document.activeElement?.closest('[role=listitem]')?.getAttribute('aria-posinset') === '1601'");
    await click('全选搜索结果');
    const originalRestore = taskRepo.restore;
    taskRepo.restore = function() { throw new Error('Injected restore failure'); };
    await click('恢复所选');
    await until("document.querySelector('.trash-view [role=alert]') !== null");
    assert.ok(await evaluate("document.querySelector('.trash-view .batch-heading').textContent.includes('已选 1601')"));
    taskRepo.restore = originalRestore;
    await click('恢复所选');
    await until("document.body.innerText.includes('回收站是空的')");
    assert.equal(taskRepo.findAll({ listId: largeProject.id }).length, 1601);
    outputs.push({test:'large-bulk-scope-trash-restore-and-virtual-keyboard',passed:true,totalTasks:1601});

    const batchProject = listRepo.create({ name: '批量体验验证', groupId: 'default-group' });
    const batchA = taskRepo.create({ title: '准备发布说明', listId: batchProject.id, dueDate: '2027-01-01T12:00:00Z' });
    const batchB = taskRepo.create({ title: '整理反馈记录', listId: batchProject.id });
    await window.loadFile(path.join(root, 'dist/renderer/index.html'));
    await until("document.body.innerText.includes('批量体验验证')");
    await click('批量体验验证'); await click('批量整理'); await click('全选当前页面');
    const originalBulk = taskRepo.bulkUpdate;
    taskRepo.bulkUpdate = function() { throw new Error('Injected bulk failure'); };
    await click('加入今天');
    await until("document.querySelector('.batch-toolbar [role=alert]') !== null");
    assert.equal(await evaluate("document.querySelector('.batch-heading strong').textContent"), '已选 2 项');
    assert.equal(taskRepo.findById(batchA.id)?.plannedDate, null);
    taskRepo.bulkUpdate = originalBulk;
    await click('加入今天');
    await until("document.querySelector('.batch-heading strong').textContent === '已选 0 项'");
    assert.equal(taskRepo.findById(batchA.id)?.plannedDate, today);
    assert.equal(taskRepo.findById(batchA.id)?.dueDate, batchA.dueDate);
    await evaluate(`document.querySelector('[aria-label="选择任务：准备发布说明"]').click()`);
    assert.equal(taskRepo.findById(batchA.id)?.status, 'todo');
    await evaluate("(() => { const el=document.querySelector('[aria-label=批量目标项目]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'inbox'); el.dispatchEvent(new Event('change',{bubbles:true})); })()");
    await click('移动项目');
    await until(`!document.querySelector('[data-task-id="${batchA.id}"]')`);
    assert.equal(taskRepo.findById(batchA.id)?.listId, 'inbox');
    await click('全选当前页面'); await click('标记完成');
    await until("document.querySelector('.batch-heading strong').textContent === '已选 0 项'");
    assert.equal(taskRepo.findById(batchB.id)?.status, 'done');
    await click('全选当前页面'); await click('移入回收站');
    await until("document.querySelector('.trash-notice') !== null");
    await click('撤销移入');
    await until("!document.querySelector('.trash-notice')");
    assert.equal(taskRepo.findById(batchB.id)?.status, 'done');
    await click('退出多选');
    await evaluate("[...document.querySelectorAll('.app-sidebar .nav-item')].find(b => b.querySelector('span')?.textContent === '收件箱').click()"); await until(`!!document.querySelector('[data-task-id="${batchA.id}"]')`);
    await evaluate(`document.querySelector('[data-task-id="${batchA.id}"] .task-body').click()`);
    await until("document.querySelector('.detail-panel') !== null");
    await click('移入回收站'); await until("document.querySelector('.trash-notice') !== null");
    await click('回收站'); await until("document.querySelector('.trash-card') !== null");
    await evaluate("(() => { const el=document.querySelector('[aria-label=搜索回收站]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'没有这个标题'); el.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await until("document.body.innerText.includes('没有匹配的任务')");
    await evaluate("(() => { const el=document.querySelector('[aria-label=搜索回收站]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'发布说明'); el.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await until("document.querySelector('.trash-card') !== null");
    window.setSize(800,600);
    await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('深色'); await evaluate("document.querySelector('.settings-dialog button.absolute').click()");
    await until("!document.querySelector('[role=dialog]')");
    await screenshot('trash-compact-dark');
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    await evaluate("window.__nativeConfirm = window.confirm; window.confirm = () => false; void 0");
    await click('永久删除任务：准备发布说明');
    assert.ok(taskRepo.findTrash().some(t=>t.id===batchA.id));
    await evaluate("window.confirm = () => true; void 0");
    await click('永久删除任务：准备发布说明');
    await until("!document.querySelector('.trash-card')");
    assert.equal(taskRepo.findTrash().some(t=>t.id===batchA.id), false);
    await evaluate("window.confirm = window.__nativeConfirm; void 0");
    outputs.push({test:'bulk-retry-plan-move-complete-undo-single-trash-search-purge',passed:true});


    // Fifth-round backup UI uses real services and an isolated file chooser response.
    window.setSize(1100,800);
    const exportedPath = path.join(data,'ui-export.dolist-backup');
    const originalSaveDialog = dialog.showSaveDialog, originalOpenDialog = dialog.showOpenDialog;
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: exportedPath });
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [exportedPath] });
    await click('设置'); await until("!!document.querySelector('.settings-dialog')");
    await click('导出完整备份');
    await until("document.querySelector('.backup-result')?.textContent.includes('已导出完整备份')");
    assert.ok(fs.existsSync(exportedPath));
    await click('选择恢复备份');
    await until("!!document.querySelector('.backup-preview')");
    assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='恢复并替换任务数据').disabled"), true);
    await screenshot('backup-preview');
    const laterTask = taskRepo.create({ title:'备份导出之后的任务', listId:'inbox' });
    await click('取消恢复'); assert.ok(taskRepo.findById(laterTask.id));
    await click('选择恢复备份');
    await until("!!document.querySelector('.backup-preview')");
    await evaluate("document.querySelector('.backup-accept input').click()");
    await click('恢复并替换任务数据');
    await until("!!document.querySelector('.restore-success')");
    assert.equal(taskRepo.findById(laterTask.id), null);
    const safetyPath = await evaluate("sessionStorage.getItem('dolist-restored-backup')");
    assert.ok(fs.existsSync(safetyPath));
    await click('关闭恢复提示');
    dialog.showSaveDialog=originalSaveDialog; dialog.showOpenDialog=originalOpenDialog;
    outputs.push({test:'backup-export-preview-cancel-confirm-and-safety-backup',passed:true});

    // A failed field edit retains its proposed value and retries the actual write.
    await click('大列表验证');
    await until("!!document.querySelector('[data-task-id=virtual-0]')");
    await evaluate("document.querySelector('[data-task-id=virtual-0] .task-body').click()");
    await until("!!document.querySelector('.detail-panel')");
    const realUpdate = taskRepo.update;
    taskRepo.update=function(id,data){if(id==='virtual-0')throw new Error('Injected field save failure');return realUpdate.call(this,id,data);};
    await evaluate("(()=>{const el=document.querySelector('.detail-panel input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2027-03-01');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await until("document.querySelector('.detail-panel [role=alert]')?.textContent.includes('重试保存字段')");
    assert.equal(await evaluate("document.querySelector('.detail-panel input[type=date]').value"),'2027-03-01');
    assert.notEqual(taskRepo.findById('virtual-0')?.plannedDate,'2027-03-01');
    await click('关闭任务详情');
    await evaluate("document.querySelector('[data-task-id=virtual-0] .task-body').click()");
    await until("document.querySelector('.detail-panel input[type=date]')?.value === '2027-03-01'");
    taskRepo.update=realUpdate; await click('重试保存字段');
    await until("document.querySelector('.detail-panel [role=alert]') === null");
    assert.equal(taskRepo.findById('virtual-0')?.plannedDate,'2027-03-01');
    await click('撤销');
    await until("!document.querySelector('.action-notice')");
    assert.equal(taskRepo.findById('virtual-0')?.plannedDate,today);
    await click('关闭任务详情');
    outputs.push({test:'failed-field-draft-retry-and-unified-undo',passed:true});

    await evaluate("document.querySelector('.sidebar-search').click()");
    await until("!!document.querySelector('input[aria-label=搜索任务]')");
    await evaluate("(()=>{const el=document.querySelector('input[aria-label=搜索任务]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'任务');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await until("document.querySelectorAll('[data-search-index]').length === 50");
    for(let i=0;i<49;i++) await evaluate("document.querySelector('input[aria-label=搜索任务]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");
    const searchBounds=await evaluate("({item:document.querySelector('[data-search-index=\"49\"]').getBoundingClientRect().toJSON(), container:document.querySelector('[data-search-index=\"49\"]').parentElement.parentElement.getBoundingClientRect().toJSON()})");
    assert.ok(searchBounds.item.bottom<=searchBounds.container.bottom+1);
    await screenshot('search-keyboard');
    await evaluate("document.querySelector('input[aria-label=搜索任务]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
    await until("!document.querySelector('input[aria-label=搜索任务]')");
    await until("!!document.querySelector('.detail-panel')");
    await click('关闭任务详情');
    outputs.push({test:'search-keyboard-scroll-and-open',passed:true});

    await runFullAuditUI({ window, evaluate, until, click, screenshot, outputs });
    await runFollowupUI({ window, evaluate, until, click, screenshot, outputs });
    assert.equal(outputs.filter(item => item.type === 'console').length, 0, JSON.stringify(outputs));
    fs.writeFileSync(path.join(root,'.audit/ui-results.json'),JSON.stringify(outputs,null,2));
    console.log(JSON.stringify(outputs,null,2)); clearTimeout(deadline); closeDatabase(); window.destroy(); app.exit(0);
  } catch (error) { console.error(error); fs.writeFileSync(path.join(root,'.audit/ui-error.txt'),String(error)); clearTimeout(deadline); closeDatabase(); app.exit(1); }
});
