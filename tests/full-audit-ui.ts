import assert from 'node:assert/strict';
import fs from 'node:fs';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
import { tagRepo } from '../src/main/db/repositories/tags.repo';
import { listRepo } from '../src/main/db/repositories/lists.repo';
import { dbRun, flushDatabase } from '../src/main/db/client';
import type { BrowserWindow } from 'electron';

export async function runFullAuditUI({ window, evaluate, until, click, screenshot, outputs }: {
  window: BrowserWindow; evaluate: (code: string) => Promise<any>; until: (code: string) => Promise<void>;
  click: (text: string) => Promise<void>; screenshot: (name: string) => Promise<void>; outputs: any[];
}) {
  const value = (selector: string, text: string) => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  window.setSize(1100,800);
  await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('浅色');
  await evaluate("document.querySelector('.settings-dialog button.absolute').click()");
  const tag = tagRepo.create('全量检查标签');
  await click('添加任务'); await until("!!document.querySelector('[aria-label=新任务标题]')");
  await click('标签'); await until("!!document.querySelector('[aria-label=\"选择标签 全量检查标签\"]')");
  await click('选择标签 全量检查标签');
  await until("document.querySelector('[aria-label=\"选择标签 全量检查标签\"]').getAttribute('aria-checked') === 'true'");
  await evaluate("document.querySelector('[aria-label=\"选择标签 全量检查标签\"]').focus()");
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});
  await until("document.querySelector('[aria-label=\"选择标签 全量检查标签\"]').getAttribute('aria-checked') === 'false'");
  await click('选择标签 全量检查标签');
  const deleteTag = tagRepo.delete;
  tagRepo.delete = () => { throw new Error('Injected tag delete failure'); };
  await evaluate("window.__auditConfirm=window.confirm;window.confirm=()=>true;void 0");
  try {
    await click('删除标签 全量检查标签');
    await until("document.querySelector('[role=alert]')?.textContent.includes('Injected tag delete failure')");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"选择标签 全量检查标签\"]').getAttribute('aria-checked')"), 'true');
  } finally { tagRepo.delete = deleteTag; }
  await click('删除标签 全量检查标签');
  await until("!document.querySelector('[aria-label=\"选择标签 全量检查标签\"]')");
  await evaluate("window.confirm=window.__auditConfirm;void 0");
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  await until("!document.querySelector('[data-radix-popper-content-wrapper]')");
  await click('取消'); await until("!document.querySelector('.quick-dialog')");
  outputs.push({test:'tag-pointer-space-delete-failure-and-retry',passed:true});

  await evaluate("document.querySelector('[data-task-id=virtual-0] .task-body').click()");
  await until("!!document.querySelector('.detail-panel')");
  await evaluate("(()=>{const el=document.querySelector('[aria-label=任务标题]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'  标题保存审计  ');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));})()");
  await until("document.querySelector('[data-task-id=virtual-0] .task-title')?.textContent === '标题保存审计'");
  await until("document.querySelector('[aria-label=任务标题]').value === '标题保存审计'");
  outputs.push({test:'detail-title-normalized-save-reflects-input',passed:true});
  await click('开始专注'); await until("!!document.querySelector('.pomodoro-panel')");
  await click('关闭任务详情');
  await click('开始');
  await until("document.querySelector('.pomodoro-panel').textContent.includes('暂停')");
  await click('暂停');
  await until("!!document.querySelector('[role=dialog]')");
  await click('继续专注');
  await until("!document.querySelector('[role=dialog]') && document.querySelector('.pomodoro-panel').textContent.includes('暂停')");
  await click('暂停'); await until("!!document.querySelector('[role=dialog]')");
  const originalUpdate = taskRepo.update;
  taskRepo.update = () => { throw new Error('Injected focus completion failure'); };
  try {
    await click('完成任务'); await until("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('请重试')");
    assert.equal(taskRepo.findById('virtual-0')?.status, 'todo');
  } finally { taskRepo.update = originalUpdate; }
  await click('完成任务'); await until("!document.querySelector('[role=dialog]')");
  assert.equal(taskRepo.findById('virtual-0')?.status, 'done');
  await screenshot('audit-focus'); await click('收起番茄钟');
  outputs.push({test:'focus-continue-resumes-and-completion-failure-retries',passed:true});

  // Real disk failure is observable in the renderer and retry persists the pending write.
  const rename = fs.renameSync;
  taskRepo.update('virtual-1', { notes:'保存失败后重试的内容' });
  fs.renameSync = (() => { throw new Error('Injected persistence failure'); }) as typeof fs.renameSync;
  try { assert.throws(flushDatabase); await until("!!document.querySelector('.save-notice')"); }
  finally { fs.renameSync = rename; }
  await click('重试保存'); await until("!document.querySelector('.save-notice')");
  outputs.push({test:'disk-save-failure-banner-and-retry',passed:true});

  await click('更多工具'); await click('四象限');
  await until("document.querySelectorAll('.matrix-grid [data-card-id]').length > 0");
  const count = await evaluate("document.querySelectorAll('.matrix-grid [data-card-id]').length");
  assert.ok(count < 80, String(count));
  const scroller = ".matrix-grid [role=list]";
  const largest = await evaluate("(()=>{const lists=[...document.querySelectorAll('.matrix-grid [role=list]')];return lists.findIndex(l=>Number(l.querySelector('[aria-setsize]')?.getAttribute('aria-setsize'))>100)})()");
  assert.ok(largest >= 0);
  await evaluate(`document.querySelectorAll(${JSON.stringify(scroller)})[${largest}].querySelector('button').focus()`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'End'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'End'});
  await until(`document.querySelectorAll(${JSON.stringify(scroller)})[${largest}].querySelector('[aria-posinset="'+document.querySelectorAll(${JSON.stringify(scroller)})[${largest}].querySelector('[aria-setsize]').getAttribute('aria-setsize')+'"] button') === document.activeElement`);
  await screenshot('audit-matrix-large');
  window.setSize(800,600); await screenshot('audit-matrix-compact');
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  outputs.push({test:'matrix-large-list-virtualization-end-key-compact-layout',passed:true,mountedCards:count});

  const reportProject = listRepo.create({name:'统计审计项目',groupId:'default-group'});
  const fresh = taskRepo.create({title:'本期未完成',listId:reportProject.id,plannedDate:new Date().toLocaleDateString('sv-SE')});
  for (let i=0;i<2;i++) {
    const old = taskRepo.create({title:'历史新增本期完成'+i,listId:reportProject.id});
    dbRun('UPDATE tasks SET created_at = ? WHERE id = ?', ['2020-01-01T00:00:00Z',old.id]);
    taskRepo.update(old.id,{status:'done'});
  }
  // Reload to exercise production fetches after inserting fixtures.
  await window.webContents.reload();
  await until("document.body.textContent.includes('统计审计项目')");
  await click('统计审计项目'); await click('更多工具'); await click('回顾');
  await until("document.body.textContent.includes('本期新增完成率')");
  assert.ok(await evaluate("document.body.textContent.includes('0%')"));
  await click('月报'); await until("!!document.querySelector('.report-heatmap')");
  const cell = await evaluate("(()=>{const b=document.querySelector('[data-report-day]'),g=b.parentElement;return {left:b.getBoundingClientRect().left,grid:g.getBoundingClientRect().left,width:b.getBoundingClientRect().width,gap:parseFloat(getComputedStyle(g).columnGap),date:b.getAttribute('data-report-day')}})()");
  const weekday = (new Date(cell.date+'T12:00:00').getDay()+6)%7;
  assert.ok(Math.abs(cell.left-cell.grid-weekday*(cell.width+cell.gap))<2);
  await evaluate("document.querySelector('[data-report-day]').click()");
  await until("document.body.textContent.includes('清除日期筛选')");
  await click('下一统计周期');
  await until("!document.body.textContent.includes('清除日期筛选')");
  await evaluate("document.querySelector('.report-heatmap').scrollIntoView({block:'center'})");
  await screenshot('audit-report-compact-light');
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  await click('设置'); await until("!!document.querySelector('.settings-dialog')"); await click('深色');
  await evaluate("document.querySelector('.settings-dialog button.absolute').click()");
  await evaluate("document.querySelector('.report-heatmap').scrollIntoView({block:'center'})");
  await screenshot('audit-report-compact-dark');
  outputs.push({test:'report-cohort-rate-weekday-alignment-period-reset-themes',passed:true});

  await click('统计审计项目'); await click('时间线');
  await until("document.body.textContent.includes('上一时间段') || !!document.querySelector('[aria-label=上一时间段]')");
  assert.ok(await evaluate("document.body.textContent.includes('本期未完成')"));
  await screenshot('audit-timeline-compact');
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  const before = await evaluate("document.querySelector('[aria-label=下一时间段]').previousElementSibling.textContent");
  await click('下一时间段');
  const after = await evaluate("document.querySelector('[aria-label=下一时间段]').previousElementSibling.textContent");
  assert.notEqual(before, after); assert.equal(after.includes('本周'),false);
  outputs.push({test:'timeline-compact-and-navigated-period-label',passed:true});
}
