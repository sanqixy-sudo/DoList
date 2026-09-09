const {app,Tray,Notification,powerMonitor,globalShortcut,screen,clipboard,ClipboardItem,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),directory=fs.mkdtempSync(path.resolve('.audit/system-data-'));
app.setPath('userData',directory);app.setPath('temp',directory);app.requestSingleInstanceLock=()=>true;globalShortcut.register=()=>false;
let nativeTray,menu;
const nativeSet=Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu=function(value){nativeTray=this;menu=value;return nativeSet.call(this,value)};
const timeout=setTimeout(()=>{console.error('System probe timeout');app.exit(1)},30000);
app.on('browser-window-created',(_event,win)=>{
 const show=win.showInactive.bind(win);win.show=show;win.focus=()=>{};
 win.webContents.once('did-finish-load',async()=>{
  try{
   for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript("!!document.querySelector('.app-shell')"))break;await new Promise(r=>setTimeout(r,25))}
   assert.ok(nativeTray&&!nativeTray.isDestroyed());assert.ok(menu.items.some(item=>item.label==='快速添加任务'));
   win.hide();nativeTray.emit('double-click');assert.equal(win.isVisible(),true);
   win.close();assert.equal(win.isDestroyed(),false);assert.equal(win.isVisible(),false);
   menu.items.find(item=>item.label==='快速添加任务').click();
   for(let i=0;i<200;i++){if(await win.webContents.executeJavaScript("!!document.querySelector('[aria-label=新任务标题]')"))break;await new Promise(r=>setTimeout(r,25))}
   assert.ok(await win.webContents.executeJavaScript("!!document.querySelector('[aria-label=新任务标题]')"));
   await win.webContents.executeJavaScript("window.__resumed=0;window.electronAPI.app.onResume(()=>window.__resumed++);void 0");
   powerMonitor.emit('resume');await new Promise(r=>setTimeout(r,100));
   assert.equal(await win.webContents.executeJavaScript("window.__resumed"),1);
   let notification='unsupported';
   if(Notification.isSupported()){
    notification=await new Promise(resolve=>{
     const n=new Notification({title:'DoList 本机验证',body:'通知功能验证完成。',silent:true});
     const timer=setTimeout(()=>{n.close();resolve('no-show-event')},5000);
     n.once('show',()=>{clearTimeout(timer);n.close();resolve('show-event')});
     n.once('failed',(_event,error)=>{clearTimeout(timer);resolve('failed: '+error)});
     n.show();
    });
   }
   // Materialize every existing format in memory before changing the clipboard.
   // Never persist or print its contents; restore only if it still holds our test image.
   const savedItems=[];
   for(const item of await clipboard.read()){
    const payload={};for(const type of item.types)payload[type]=await item.getType(type);
    savedItems.push(new ClipboardItem(payload));
   }
   const testPNG=nativeImage.createFromPath(path.join(root,'resources/icon.png')).resize({width:2,height:2}).toPNG();
   assert.ok(testPNG.length>0);
   let clipboardRestored=false;
   try {
    await clipboard.write([new ClipboardItem({'image/png':new Blob([testPNG],{type:'image/png'})})]);
    const pasted=await win.webContents.executeJavaScript("window.electronAPI.tasks.pasteClipboardImage()");
    assert.ok(pasted&&pasted.mimeType==='image/png');
    assert.deepEqual(nativeImage.createFromPath(pasted.sourcePath).getSize(),{width:2,height:2});
    assert.ok(path.resolve(pasted.sourcePath).startsWith(directory+path.sep));
   } finally {
    const current=(await clipboard.read()).find(item=>item.types.includes('image/png'));
    if(current&&nativeImage.createFromBuffer(Buffer.from(await (await current.getType('image/png')).arrayBuffer())).toPNG().equals(nativeImage.createFromBuffer(testPNG).toPNG())){
     if(savedItems.length)await clipboard.write(savedItems);else await clipboard.clear();clipboardRestored=true;
    }
   }
   const result={clipboardImageRoundtrip:true,clipboardRestored,trayCreated:true,trayDoubleClickCallback:true,closeHidesWindow:true,trayQuickAdd:true,simulatedResumeDelivered:true,notification,displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor}))};
   fs.writeFileSync(path.join(root,'.audit/system-results.json'),JSON.stringify(result,null,2));console.log(result);
   clearTimeout(timeout);app.quit();
  }catch(error){console.error(error);clearTimeout(timeout);app.exit(1)}
 });
});
require(path.join(root,'dist/main/index.js'));
