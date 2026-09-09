const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),root=process.cwd(),electron=require('electron');
esbuild.buildSync({entryPoints:['tests/crash-probe.ts'],outfile:'.audit/crash-probe.cjs',bundle:true,platform:'node',external:['electron','sql.js']});
const directory=fs.mkdtempSync(path.resolve('.audit/crash-data-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
(async()=>{
 const writer=spawn(electron,['.audit/crash-probe.cjs','write',directory],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{writer.kill();reject(Error('Writer timeout'));},20000);
  let output='',killed=false;
  writer.stdout.on('data',chunk=>{output+=chunk;if(output.includes('COMMITTED')&&!killed){killed=true;writer.kill('SIGKILL');}});
  writer.on('exit',()=>{clearTimeout(timer);killed?resolve():reject(Error(output));});
 });
 const journal=path.join(directory,'ticklike.db.journal');
 assert.ok(fs.statSync(journal).size>0,'Must kill before checkpoint');
 const corrupt=fs.mkdtempSync(path.resolve('.audit/crash-corrupt-'));
 fs.copyFileSync(path.join(directory,'ticklike.db'),path.join(corrupt,'ticklike.db'));
 fs.writeFileSync(path.join(corrupt,'ticklike.db.journal'),fs.readFileSync(journal,'utf8').replace('强杀恢复验证','被破坏的内容'));
 fs.appendFileSync(journal,'{"sequence":');
 const reader=spawnSync(electron,['.audit/crash-probe.cjs','read',directory],{env,windowsHide:true,encoding:'utf8',timeout:20000});
 assert.equal(reader.status,0,reader.stdout+reader.stderr);assert.ok(reader.stdout.includes('RECOVERED'));
 assert.ok(fs.readdirSync(directory).some(name=>name.includes('.partial-')));
 const rejected=spawnSync(electron,['.audit/crash-probe.cjs','read',corrupt],{env,windowsHide:true,encoding:'utf8',timeout:20000});
 assert.equal(rejected.status,2);assert.ok((rejected.stdout+rejected.stderr).includes('事务日志校验失败'));
 const result={realForceTermination:true,recoveredAcknowledgedTaskAndAttachment:true,partialTailRecovered:true,corruptJournalRejected:true};
 fs.writeFileSync('.audit/crash-results.json',JSON.stringify(result,null,2));console.log(result);
})().catch(error=>{console.error(error);process.exitCode=1});
