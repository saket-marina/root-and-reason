import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-root-remedy-team-m2';
const HOST = '127.0.0.1';
const PORT = 8088;
const APP_NAME = 'root-remedy-emulator-only';
const CONNECTION_KEY = Symbol.for('root-remedy.local-firestore.connection');
const names = { remedies: 'appPreviewRemedies', goals: 'appPreviewGoals', traditions: 'appPreviewTraditions', sources: 'appPreviewSources', studies: 'appPreviewStudies' };
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

function localConnection() {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'firestore') throw new Error('Start the app with npm run dev:firestore to use the local catalog.');
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)) throw new Error('The Firestore preview is available only from localhost.');
  if (!['http:', 'https:'].includes(window.location.protocol)) throw new Error('Open the local development website to use the Firestore preview.');
  const cached = globalThis[CONNECTION_KEY];
  if (cached) {
    if (cached.projectId !== PROJECT_ID || cached.host !== HOST || cached.port !== PORT) throw new Error('Unexpected local Firestore connection settings.');
    return cached.database;
  }
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing && existing.options.projectId !== PROJECT_ID) throw new Error('Unexpected project ID for the local Firestore preview.');
  const app = existing || initializeApp({ projectId: PROJECT_ID, apiKey: 'local-emulator-only', appId: 'root-remedy-local-preview' }, APP_NAME);
  const database = getFirestore(app);
  // Connect before any read. Project, host, and port are fixed and cannot be
  // overridden by cloud configuration or other Vite environment variables.
  connectFirestoreEmulator(database, HOST, PORT);
  globalThis[CONNECTION_KEY] = { database, projectId: PROJECT_ID, host: HOST, port: PORT };
  return database;
}

/** Load a verified draft catalog exclusively from the localhost emulator. */
export async function loadLocalFirestoreCatalog() {
  const database = localConnection();
  const releaseSnapshot = await getDoc(doc(database, 'appPreviewReleases', 'current'));
  if (!releaseSnapshot.exists()) throw new Error('Local Firestore has no catalog release. Run the local seed command.');
  const release = releaseSnapshot.data();
  if (release.id !== 'current' || release.localPreview !== true || release.publicationStatus !== 'draft' || release.environment !== 'local-preview' || release.schemaVersion !== 'app-preview-1' || release.projectId !== PROJECT_ID || release.emulatorHost !== `${HOST}:${PORT}` || !/^local-[a-f0-9]{12}$/.test(release.releaseId || '') || !/^[a-f0-9]{64}$/.test(release.contentSha256 || '')) throw new Error('The local Firestore catalog release is invalid.');
  const collections = await Promise.all(Object.entries(names).map(async ([key, name]) => {
    const count = release.counts?.[key];
    if (!Number.isInteger(count) || count < 0 || count > 5000) throw new Error(`Invalid preview count for ${key}.`);
    const snapshot = await getDocs(collection(database, name));
    if (snapshot.size !== count) throw new Error(`Local Firestore catalog is incomplete: ${key}. Rerun the seed command.`);
    const records = snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data();
      const { localPreview, publicationStatus, environment, releaseId, ...record } = data;
      if (localPreview !== true || publicationStatus !== 'draft' || environment !== 'local-preview' || releaseId !== release.releaseId || record.id !== snapshotDoc.id) throw new Error(`Invalid local preview record: ${name}/${snapshotDoc.id}.`);
      return record;
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    return [key, records];
  }));
  const payload = Object.fromEntries(collections);
  if (payload.remedies.length < 20 || !payload.goals.length || !payload.sources.length) throw new Error('The local preview is missing required catalog records.');
  if (payload.remedies.some((remedy) => remedy.safety?.safetyScore !== null)) throw new Error('The preview must retain null safety scores.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(payload)));
  const actualHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  if (actualHash !== release.contentSha256) throw new Error('Local Firestore catalog integrity check failed. Rerun the seed command.');
  if (`local-${actualHash.slice(0, 12)}` !== release.releaseId) throw new Error('Local preview release ID does not match its contents.');
  const remedies = payload.remedies;
  const goals = payload.goals.sort((a, b) => a.displayName.localeCompare(b.displayName));
  const traditions = payload.traditions;
  const sourceById = Object.fromEntries(payload.sources.map((source) => [source.id, source]));
  const studyById = Object.fromEntries(payload.studies.map((study) => [study.id, study]));
  return {
    remedies, goals, traditions, sourceById, studyById,
    getRemedy: (idOrSlug) => remedies.find((remedy) => remedy.id === idOrSlug || remedy.slug === idOrSlug),
    getGoal: (id) => goals.find((goal) => goal.id === id),
    release,
  };
}
