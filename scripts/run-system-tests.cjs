const {spawnSync}=require('node:child_process');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result=spawnSync(require('electron'),['tests/system-probe.cjs'],{env,stdio:'inherit',windowsHide:true,timeout:35000});
if(result.error)console.error(result.error);
process.exit(result.status??1);
