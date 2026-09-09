const {app,globalShortcut}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd();
app.setPath('userData',process.env.DOLIST_PROBE_DATA);
app.requestSingleInstanceLock=()=>true;
globalShortcut.register=()=>false;
const started=Number(process.env.DOLIST_PROBE_START);
const deadline=setTimeout(()=>{console.error('Startup probe timed out');app.exit(1)},45000);
app.on('browser-window-created',(_event,win)=>{
 win.show=()=>{}; win.webContents.setBackgroundThrottling(false);
 win.webContents.once('did-finish-load',async()=>{
  try {
   const evalJS=code=>win.webContents.executeJavaScript(code,true);
   for(let i=0;i<500;i++){if(await evalJS("!!document.querySelector('[data-task-id]')"))break;await new Promise(r=>setTimeout(r,20));}
   if(!await evalJS("!!document.querySelector('[data-task-id]')"))throw Error('No task row');
   const readyMs=Date.now()-started;
   const search=await evalJS("(async()=>{const samples=[];for(let i=0;i<10;i++){const t=performance.now();const rows=await window.electronAPI.tasks.search('测试');samples.push({ms:performance.now()-t,count:rows.length});}return samples})()");
   await evalJS("document.querySelector('.sidebar-search').click()");
   for(let i=0;i<200;i++){if(await evalJS("!!document.querySelector('[aria-label=搜索任务] input, input[aria-label=搜索任务]')"))break;await new Promise(r=>setTimeout(r,10));}
   const queryStart=Date.now();
   await evalJS("(()=>{const el=document.querySelector('input[aria-label=搜索任务]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'测试');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
   for(let i=0;i<300;i++){if(await evalJS("document.querySelector('[role=dialog] [role=status]')?.textContent.includes('50')"))break;await new Promise(r=>setTimeout(r,10));}
   const searchUiMs=Date.now()-queryStart;
   await evalJS("document.querySelector('[role=dialog] button.absolute').click()");
   const switches=[];
   for(const [label,selector] of [['看板','.board-column .task-card'],['日历','.calendar-view'],['列表','[data-task-id]']]){
    const t=Date.now();
    await evalJS("[...document.querySelectorAll('.view-tabs button')].find(b=>b.textContent.trim()==="+JSON.stringify(label)+").click()");
    let found=false;
    for(let i=0;i<400;i++){if(await evalJS("!!document.querySelector("+JSON.stringify(selector)+")")){found=true;break;}await new Promise(r=>setTimeout(r,10));}
    if(!found)throw Error('View not ready: '+label);
    switches.push({view:label,ms:Date.now()-t});
   }
   const modules=await evalJS("performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).map(r=>r.name.split('/').pop())");
   console.log('PROBE_RESULT '+JSON.stringify({readyMs,search,searchUiMs,switches,modules}));
   clearTimeout(deadline);app.quit();
  } catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
 });
});
require(path.join(root,'dist/main/index.js'));
