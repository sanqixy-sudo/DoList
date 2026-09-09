const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const esbuild = require('esbuild');
const audit = path.resolve('.audit');
fs.mkdirSync(audit, { recursive: true });
const dataPath = fs.mkdtempSync(path.join(audit, 'test-data-'));
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'electron') return { app: { getPath: kind => kind === 'temp' ? audit : dataPath } };
  return originalLoad.call(this, name, parent, main);
};
global.__TEST_DATA_PATH__ = dataPath;
const stored = new Map();
global.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
esbuild.buildSync({ entryPoints: ['tests/core.test.ts'], outfile: '.audit/core-tests.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'sql.js'], logLevel: 'warning' });
require('../.audit/core-tests.cjs');
