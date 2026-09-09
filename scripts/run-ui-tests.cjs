const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
process.chdir(root);
fs.mkdirSync('.audit', { recursive: true });
esbuild.buildSync({ entryPoints: ['tests/electron-smoke.ts'], outfile: '.audit/electron-smoke.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'sql.js'], logLevel: 'warning' });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(require('electron'), ['.audit/electron-smoke.cjs'], { cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 250000 });
if (result.error) console.error(result.error);
if (result.status !== 0) {
  if (fs.existsSync('.audit/ui-error.txt')) console.error(fs.readFileSync('.audit/ui-error.txt', 'utf8'));
  process.exit(result.status || 1);
}
console.log('Electron 界面检查通过，截图和结果位于 .audit/。');
