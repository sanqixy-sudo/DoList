const {app,globalShortcut,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path');
const directory=process.env.DOLIST_INSTALL_TEST_DATA;
if(!directory||!path.isAbsolute(directory)||!path.basename(directory).startsWith('installer-data-'))throw Error('Isolated install test directory required');
app.setPath('userData',directory);app.requestSingleInstanceLock=()=>true;globalShortcut.register=()=>false;
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(directory,'installed-worker-backup.dolist-backup')});
const timer=setTimeout(()=>app.exit(2),25000);
app.on('browser-window-created',(_event,win)=>{
 win.show=()=>{};
 win.webContents.once('did-finish-load',async()=>{
  try{
   const evaluate=code=>win.webContents.executeJavaScript(code,true);
   for(let i=0;i<200;i++){if(await evaluate("!!document.querySelector('.app-shell')"))break;await new Promise(r=>setTimeout(r,25))}
   const before=await evaluate("window.electronAPI.tasks.search('安装保留任务')");
   if(process.env.DOLIST_INSTALL_TEST_PHASE==='upgrade'&&before.length!==1)throw Error('Upgrade lost task');
   const task=before[0]??await evaluate("window.electronAPI.tasks.create({title:'安装保留任务',listId:'inbox',notes:'卸载仍保留数据'})");
   const backup=await evaluate("window.electronAPI.backup.export()");
   if(!fs.existsSync(backup.path))throw Error('Packaged worker failed');
   fs.writeFileSync(path.join(directory,'result-'+process.env.DOLIST_INSTALL_TEST_PHASE+'.json'),JSON.stringify({version:app.getVersion(),taskId:task.id,notes:task.notes,packagedWorker:true}));
   clearTimeout(timer);app.quit();
  }catch(error){fs.writeFileSync(path.join(directory,'error.txt'),String(error));clearTimeout(timer);app.exit(2)}
 });
});
require('./dist/main/index.js');
