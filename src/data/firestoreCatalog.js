import samples from '../../data/remedy-samples.json';
import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  getDocs,
  getFirestore,
} from 'firebase/firestore/lite';

const PROJECT_ID = 'demo-root-remedy-team-m2';

function getDatabase() {
  const existing = getApps().find((app) => app.name === PROJECT_ID);
  const app = existing || initializeApp(
    { projectId: PROJECT_ID },
    PROJECT_ID
  );

  const database = getFirestore(app);

  if (!existing) {
    connectFirestoreEmulator(database, '127.0.0.1', 8088);
  }

  return database;
}

async function readCollection(database, name) {
  const snapshot = await getDocs(collection(database, name));

  return snapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
}

export async function loadFirestoreCatalog(signal) {
  let remedies, goals, studies, origins;

  if (import.meta.env.DEV && import.meta.env.MODE === 'firestore') {
    const database = getDatabase();

    [remedies, goals, studies, origins] = await Promise.all([
      readCollection(database, 'remedies'),
      readCollection(database, 'healthGoals'),
      readCollection(database, 'studies'),
      readCollection(database, 'origins'),
    ]);
  } else {
    remedies = samples.remedies;
    goals = samples.healthGoals;
    studies = samples.studies;
    origins = samples.origins;
  }

  if (signal?.aborted) {
    throw new Error('Catalog request cancelled');
  }

  if (!remedies.length || !goals.length) {
    throw new Error('No remedies found. Seed the Firestore emulator first.');
  }

  const goalIds = new Set(goals.map((goal) => goal.id));
  const studyIds = new Set(studies.map((study) => study.id));

  const sources = studies
    .filter((study) => study.sourceUrl)
    .map((study) => ({
      id: `study-source-${study.id}`,
      title: study.title,
      url: study.sourceUrl,
    }));

  const mappedRemedies = remedies.map((remedy) => {
    if (
      !Array.isArray(remedy.healthGoalIds) ||
      !Array.isArray(remedy.studyIds) ||
      remedy.healthGoalIds.some((id) => !goalIds.has(id)) ||
      remedy.studyIds.some((id) => !studyIds.has(id))
    ) {
      throw new Error(`Invalid references for remedy ${remedy.id}`);
    }

    return {
      ...remedy,
      goalIds: remedy.healthGoalIds,
      searchTerms: remedy.ingredients || [],
      researchNote: remedy.summary || '',
      researchSourceIds: remedy.studyIds
        .filter((id) => sources.some((source) => source.id === `study-source-${id}`))
        .map((id) => `study-source-${id}`),
    };
  });

  const mappedStudies = studies.map((study) => ({
    ...study,
    human: true,
    participantCount: study.participantsAnalyzed ?? null,
    sourceIds: study.sourceUrl ? [`study-source-${study.id}`] : [],
  }));

  return {
    goals,
    remedies: mappedRemedies,
    studies: mappedStudies,
    sources,
    origins,
  };
}
