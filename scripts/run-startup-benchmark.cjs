const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
process.chdir(path.resolve(__dirname,'..'));
const label=process.argv[2]||'current';
const source=fs.readdirSync('.audit',{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('benchmark-data-')).map(d=>path.resolve('.audit',d.name,'ticklike.db')).filter(p=>fs.existsSync(p)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
if(!source)throw Error('Run npm run benchmark first to seed 3000 tasks');
const results=[];
for(let i=0;i<3;i++){
 const data=fs.mkdtempSync(path.resolve('.audit/startup-data-'));fs.copyFileSync(source,path.join(data,'ticklike.db'));
 const env={...process.env,DOLIST_PROBE_DATA:data,DOLIST_PROBE_START:String(Date.now())};delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_RENDERER_URL;
 const r=spawnSync(require('electron'),['tests/startup-probe.cjs'],{env,encoding:'utf8',windowsHide:true,timeout:50000});
 if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);
 const line=r.stdout.split('\n').find(l=>l.startsWith('PROBE_RESULT '));if(!line)throw Error(r.stdout);
 results.push(JSON.parse(line.slice(13)));
}
const output={label,count:3000,description:'Fresh Electron process using production main/preload/renderer and isolated database; hidden window, global shortcuts disabled; OS caches not cleared.',results};
fs.writeFileSync('.audit/startup-'+label+'.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
