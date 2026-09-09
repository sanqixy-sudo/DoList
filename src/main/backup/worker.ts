import { parentPort, workerData } from 'node:worker_threads';
import { initSnapshotDatabase } from '../db/client';
import { exportBackup, inspectBackup, prepareRestore, setBackupHooks } from './service';
(async () => {
  const canceled = new Int32Array(workerData.cancel);
  setBackupHooks({
    check: () => { if (Atomics.load(canceled, 0)) throw new Error('备份操作已取消'); },
    progress: (phase, percent) => parentPort!.postMessage({ progress: { phase, percent, canCancel: true } }),
  });
  await initSnapshotDatabase(workerData.snapshot, workerData.directory);
  const result = workerData.operation === 'export' ? exportBackup(workerData.output)
    : workerData.operation === 'preview' ? inspectBackup(workerData.file)
    : prepareRestore(workerData.file, workerData.fingerprint, workerData.restoreFolder);
  if (Atomics.load(canceled, 0)) throw new Error('备份操作已取消');
  parentPort!.postMessage({ result });
})().catch(error => parentPort!.postMessage({ error: String(error.message ?? error) }));
