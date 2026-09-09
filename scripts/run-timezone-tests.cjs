const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
require('esbuild').buildSync({entryPoints:['types/validation.ts'],outfile:'.audit/date-validation.cjs',bundle:true,platform:'node'});
const zones=['UTC','Asia/Shanghai','America/New_York','America/Los_Angeles','Europe/Berlin','Australia/Lord_Howe','Pacific/Apia'];
const results=[];
for(const zone of zones){
 const code="const {normalizeTimestamp,validDay}=require('./.audit/date-validation.cjs');const assert=require('node:assert/strict');assert.equal(validDay('2024-02-29'),true);assert.equal(validDay('2026-02-29'),false);assert.equal(normalizeTimestamp('2026-11-01T01:30:00-04:00'),'2026-11-01T05:30:00.000Z');assert.equal(normalizeTimestamp('2026-11-01T01:30:00-05:00'),'2026-11-01T06:30:00.000Z');if(process.env.TZ==='America/New_York')assert.throws(()=>normalizeTimestamp('2026-03-08T02:30:00'));if(process.env.TZ==='Europe/Berlin')assert.throws(()=>normalizeTimestamp('2026-03-29T02:30:00'));if(process.env.TZ==='Australia/Lord_Howe')assert.throws(()=>normalizeTimestamp('2026-10-04T02:15:00'));if(process.env.TZ==='Pacific/Apia'){assert.throws(()=>normalizeTimestamp('2011-12-30'));assert.throws(()=>normalizeTimestamp('2011-12-30T12:00:00'));}console.log(JSON.stringify({zone:process.env.TZ,dateOnly:normalizeTimestamp('2026-09-09'),passed:true}))";
 const r=spawnSync(process.execPath,['-e',code],{env:{...process.env,TZ:zone},encoding:'utf8',windowsHide:true});
 assert.equal(r.status,0,r.stdout+r.stderr);results.push(JSON.parse(r.stdout));
}
fs.writeFileSync('.audit/timezone-results.json',JSON.stringify(results,null,2));console.log(results);
