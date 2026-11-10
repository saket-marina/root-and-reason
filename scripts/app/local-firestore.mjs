import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { isDeepStrictEqual } from 'node:util';
import { remedies, goals, traditions, sourceById, studyById } from '../../src/data/catalog.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_ID = 'demo-root-remedy-team-m2';
const HOST = '127.0.0.1';
const PORT = 8088;
const ADDRESS = `${HOST}:${PORT}`;
const SCHEMA_VERSION = 'app-preview-1';
const collectionNames = {
  remedies: 'appPreviewRemedies',
  goals: 'appPreviewGoals',
  traditions: 'appPreviewTraditions',
  sources: 'appPreviewSources',
  studies: 'appPreviewStudies',
};
const flags = { localPreview: true, publicationStatus: 'draft', environment: 'local-preview' };
const plain = (value) => JSON.parse(JSON.stringify(value));
const sortRecords = (records) => plain(records).sort((a, b) => a.id.localeCompare(b.id, 'en'));
const expected = {
  remedies: sortRecords(remedies),
  goals: sortRecords(goals),
  traditions: sortRecords(traditions),
  sources: sortRecords(Object.values(sourceById)),
  studies: sortRecords(Object.values(studyById)),
};
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const contentSha256 = createHash('sha256').update(stable(expected)).digest('hex');
const releaseId = `local-${contentSha256.slice(0, 12)}`;
const counts = Object.fromEntries(Object.entries(expected).map(([key, records]) => [key, records.length]));
const release = { id: 'current', ...flags, schemaVersion: SCHEMA_VERSION, projectId: PROJECT_ID, emulatorHost: ADDRESS, releaseId, contentSha256, counts };

function fail(message) { throw new Error(message); }
function assertLocalHost() {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST !== ADDRESS) {
    fail(`FIRESTORE_EMULATOR_HOST must be ${ADDRESS}; refusing another endpoint.`);
  }
  process.env.FIRESTORE_EMULATOR_HOST = ADDRESS;
  process.env.GCLOUD_PROJECT = PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
  process.env.METADATA_SERVER_DETECTION = 'none';
}
function portOpen() {
  return new Promise((done) => {
    const socket = connect({ host: HOST, port: PORT });
    const finish = (result) => { socket.destroy(); done(result); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(800, () => finish(false));
  });
}
async function localDatabase() {
  assertLocalHost();
  if (!await portOpen()) fail(`No local Firestore emulator at ${ADDRESS}. Run this script with start first.`);
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  // The Admin SDK detects FIRESTORE_EMULATOR_HOST. The explicit project ID,
  // plaintext loopback endpoint, and disabled metadata detection keep this local.
  const app = initializeApp({ projectId: PROJECT_ID }, `rr-local-${process.pid}`);
  const database = getFirestore(app);
  database.settings({ host: ADDRESS, ssl: false, ignoreUndefinedProperties: true });
  return { app, database };
}
function unwrap(document) {
  const { localPreview, publicationStatus, environment, releaseId: documentRelease, ...record } = document;
  if (localPreview !== true || publicationStatus !== 'draft' || environment !== 'local-preview' || documentRelease !== releaseId) fail('Preview document flags or release do not match this local catalog. Rerun seed.');
  return record;
}
async function verify(database) {
  const actualRelease = await database.collection('appPreviewReleases').doc('current').get();
  if (!actualRelease.exists || !isDeepStrictEqual(actualRelease.data(), release)) fail('Local release does not match the current catalog. Rerun seed.');
  const collections = await Promise.all(Object.entries(collectionNames).map(async ([key, collection]) => {
    const snapshot = await database.collection(collection).get();
    const records = snapshot.docs.map((doc) => {
      const record = unwrap(doc.data());
      if (record.id !== doc.id) fail(`ID mismatch in ${collection}/${doc.id}`);
      return record;
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (!isDeepStrictEqual(records, expected[key])) fail(`Readback mismatch in ${collection}`);
    return [key, records];
  }));
  const readback = Object.fromEntries(collections);
  const readbackHash = createHash('sha256').update(stable(readback)).digest('hex');
  if (readbackHash !== contentSha256) fail('Local catalog hash mismatch.');
  const base = `http://${ADDRESS}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const readable = await fetch(`${base}/appPreviewRemedies?pageSize=1000`, { signal: AbortSignal.timeout(5000) });
  if (!readable.ok) fail(`Anonymous preview read was denied (${readable.status}).`);
  const publicRecords = await readable.json();
  if (publicRecords.documents?.length !== counts.remedies) fail('Anonymous read returned an incomplete remedy catalog.');
  const protectedRead = await fetch(`${base}/privatePreviewProbe/hidden`, { signal: AbortSignal.timeout(5000) });
  if (protectedRead.status !== 403) fail(`Private collection read was not denied (${protectedRead.status}).`);
  const probeId = 'local-browser-write-probe';
  const writeAttempt = await fetch(`${base}/appPreviewRemedies/${probeId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { id: { stringValue: probeId }, localPreview: { booleanValue: true } } }),
    signal: AbortSignal.timeout(5000),
  });
  if (writeAttempt.status !== 403) {
    await database.collection('appPreviewRemedies').doc(probeId).delete();
    fail(`Anonymous browser write was not denied (${writeAttempt.status}).`);
  }
  console.log(JSON.stringify({ verified: true, localOnly: true, projectId: PROJECT_ID, emulatorHost: ADDRESS, releaseId, contentSha256, counts, documentCount: Object.values(counts).reduce((a, b) => a + b, 1), anonymousRead: 'allowed for preview collections', anonymousWrite: 'denied', otherCollectionRead: 'denied' }, null, 2));
}
async function seedAndVerify(database) {
  // All catalog documents and the current release switch in one local batch.
  // Remove stale IDs only inside the explicitly named preview collections.
  const batch = database.batch();
  let operations = 0;
  for (const [key, collection] of Object.entries(collectionNames)) {
    const ids = new Set(expected[key].map((record) => record.id));
    const existing = await database.collection(collection).get();
    for (const document of existing.docs) if (!ids.has(document.id)) { batch.delete(document.ref); operations += 1; }
    for (const record of expected[key]) { batch.set(database.collection(collection).doc(record.id), { ...record, ...flags, releaseId }); operations += 1; }
  }
  batch.set(database.collection('appPreviewReleases').doc('current'), release);
  operations += 1;
  if (operations > 500) fail('Local catalog exceeds one atomic batch; split seeding must be implemented explicitly.');
  await batch.commit();
  console.log(`Seeded ${operations} local preview operations at ${ADDRESS}.`);
  await verify(database);
}
async function withDatabase(action) {
  const { app, database } = await localDatabase();
  try { await action(database); }
  finally {
    await database.terminate();
    const { deleteApp } = await import('firebase-admin/app');
    await deleteApp(app);
  }
}
async function start() {
  assertLocalHost();
  if (await portOpen()) fail(`Port ${PORT} is already occupied. Use seed or verify for the existing local emulator.`);
  const env = { ...process.env, CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', METADATA_SERVER_DETECTION: 'none' };
  if (spawnSync('java', ['-version'], { stdio: 'ignore', env }).status !== 0) {
    for (const bin of ['/opt/homebrew/opt/openjdk/bin', '/usr/local/opt/openjdk/bin']) {
      try { await access(resolve(bin, 'java')); env.PATH = bin + delimiter + env.PATH; break; } catch { /* Try the next installed JDK. */ }
    }
  }
  if (spawnSync('java', ['-version'], { stdio: 'ignore', env }).status !== 0) fail('A working local Java runtime is required for the Firestore emulator.');
  const cli = resolve(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js');
  const child = spawn(process.execPath, [cli, 'emulators:start', '--only', 'firestore', '--project', PROJECT_ID, '--config', resolve(ROOT, 'firebase.local.json'), '--non-interactive'], { cwd: ROOT, env, stdio: ['inherit', 'pipe', 'pipe'] });
  let output = '';
  let onReady;
  const ready = new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local emulator did not become ready within 90 seconds.')), 90_000);
    onReady = () => { clearTimeout(timeout); done(); };
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Local emulator exited before readiness (${code}).`)); });
  });
  const log = (chunk, stream) => {
    stream.write(chunk);
    output = (output + chunk.toString()).slice(-15_000);
    if (output.includes('All emulators ready!')) onReady();
  };
  child.stdout.on('data', (chunk) => log(chunk, process.stdout));
  child.stderr.on('data', (chunk) => log(chunk, process.stderr));
  const stop = (signal) => child.kill(signal);
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
  try {
    await ready;
    await withDatabase(seedAndVerify);
    console.log(`Local Firestore is ready at ${ADDRESS}. Leave this process running; Ctrl+C stops it. No cloud project is used.`);
    const exitCode = await new Promise((done) => child.once('exit', done));
    process.exitCode = exitCode ?? 0;
  } catch (error) {
    child.kill('SIGINT');
    throw error;
  }
}

const command = process.argv[2] || 'start';
if (process.argv.length > 3 || !['start', 'seed', 'verify'].includes(command)) {
  console.error('Usage: node scripts/app/local-firestore.mjs [start|seed|verify]');
  process.exitCode = 1;
} else {
  try {
    if (command === 'start') await start();
    else if (command === 'seed') await withDatabase(seedAndVerify);
    else await withDatabase(verify);
  } catch (error) {
    console.error(`Local Firestore: ${error.message}`);
    process.exitCode = 1;
  }
}
