const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),audit=path.resolve('.audit'),appDir=fs.mkdtempSync(path.join(audit,'installer-app-')),directory=fs.mkdtempSync(path.join(audit,'installer-data-'));
const installDir=path.join(audit,'installed-'+crypto.randomUUID());
assert.equal(path.dirname(installDir),audit);
for(const folder of ['dist','resources'])fs.cpSync(path.join(root,folder),path.join(appDir,folder),{recursive:true});
fs.mkdirSync(path.join(appDir,'node_modules'),{recursive:true});fs.cpSync(path.join(root,'node_modules/sql.js'),path.join(appDir,'node_modules/sql.js'),{recursive:true});
fs.copyFileSync('tests/installed-probe.cjs',path.join(appDir,'probe.cjs'));
const name='DoList Audit '+crypto.randomBytes(4).toString('hex'),appId='com.dolist.audit.'+crypto.randomBytes(4).toString('hex');
const config={electronDist:path.resolve('node_modules/electron/dist'),appId,productName:name,executableName:'DoListAudit',directories:{app:appDir,output:path.join(appDir,'output')},files:['dist/**/*','resources/**/*','probe.cjs','package.json'],asar:true,win:{target:'nsis',icon:path.resolve('resources/icon.ico')},nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:false,createStartMenuShortcut:false,runAfterFinish:false,deleteAppDataOnUninstall:false}};
const configFile=path.join(appDir,'builder.json');fs.writeFileSync(configFile,JSON.stringify(config));
const env={...process.env,ELECTRON_BUILDER_BINARIES_MIRROR:'https://npmmirror.com/mirrors/electron-builder-binaries/'};delete env.ELECTRON_RUN_AS_NODE;
function run(executable,args,options={}){const r=spawnSync(executable,args,{env,windowsHide:true,encoding:'utf8',timeout:180000,...options});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr+'\n'+r.error);return r}
(async()=>{
 const results=[];
 try {
 for(const [version,phase] of [['0.0.1','install'],['0.0.2','upgrade']]){
  fs.writeFileSync(path.join(appDir,'package.json'),JSON.stringify({name:'dolist-install-audit',version,description:'Isolated installer validation',author:'DoList',main:'probe.cjs',dependencies:{'sql.js':require(path.join(root,'node_modules/sql.js/package.json')).version}}));
  console.log('Building isolated installer '+version);
  const output=run(process.execPath,[path.resolve('node_modules/electron-builder/cli.js'),'--config',configFile,'--win','nsis','--publish','never']);
  fs.writeFileSync(path.join(appDir,'build-'+version+'.log'),output.stdout+output.stderr);
  const installer=path.join(appDir,'output',name+' Setup '+version+'.exe');assert.ok(fs.existsSync(installer));
  run(installer,['/S','/D='+installDir]);
  assert.ok(fs.existsSync(path.join(installDir,'DoListAudit.exe')));
  run(path.join(installDir,'DoListAudit.exe'),[],{env:{...env,DOLIST_INSTALL_TEST_DATA:directory,DOLIST_INSTALL_TEST_PHASE:phase},timeout:30000});
  console.log('Installed application and packaged backup passed: '+version);
  results.push(JSON.parse(fs.readFileSync(path.join(directory,'result-'+phase+'.json'))));
 }
 assert.equal(results[0].taskId,results[1].taskId);assert.equal(results[1].notes,'卸载仍保留数据');
 const uninstaller=fs.readdirSync(installDir).find(name=>name.startsWith('Uninstall')&&name.endsWith('.exe'));assert.ok(uninstaller);
 run(path.join(installDir,uninstaller),['/S']);
 for(let i=0;i<100&&fs.existsSync(path.join(installDir,'DoListAudit.exe'));i++)await new Promise(r=>setTimeout(r,100));
 assert.equal(fs.existsSync(path.join(installDir,'DoListAudit.exe')),false);assert.ok(fs.existsSync(path.join(directory,'ticklike.db')));
 const result={isolatedAppId:appId,installDirectory:installDir,versions:results,uninstalled:true,userDataRetained:true};
 fs.writeFileSync('.audit/installer-results.json',JSON.stringify(result,null,2));console.log(result);
 } finally {
  if(fs.existsSync(path.join(installDir,'DoListAudit.exe'))){
   const uninstaller=fs.readdirSync(installDir).find(name=>name.startsWith('Uninstall')&&name.endsWith('.exe'));
   if(uninstaller)run(path.join(installDir,uninstaller),['/S']);
  }
 }
})().catch(error=>{console.error(error);process.exitCode=1});
