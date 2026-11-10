import { useEffect, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, getDocs, getFirestore } from 'firebase/firestore/lite';

const projectId = 'demo-root-remedy-team-m2';
const existingApp = getApps().find(app => app.name === projectId);
const database = getFirestore(existingApp ?? initializeApp({ projectId }, projectId));
if (!existingApp) connectFirestoreEmulator(database, '127.0.0.1', 8088);

async function readCollection(name) {
  const snapshot = await getDocs(collection(database, name));
  return new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));
}

async function loadSamples() {
  const [remedies, goals, studies, origins] = await Promise.all(
    ['remedies', 'healthGoals', 'studies', 'origins'].map(readCollection),
  );
  const records = [...remedies.values()].map(remedy => ({
    ...remedy,
    goals: remedy.healthGoalIds.map(id => goals.get(id)),
    studies: remedy.studyIds.map(id => studies.get(id)),
    origins: remedy.originIds.map(id => origins.get(id)),
  }));
  if (records.some(remedy => [...remedy.goals, ...remedy.studies, ...remedy.origins].includes(undefined))) {
    throw new Error('A sample references a missing Firestore record.');
  }
  return records;
}

export default function CatalogPreview() {
  const [remedies, setRemedies] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadSamples().then(records => {
      if (active) setRemedies(records);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  if (failed || remedies?.length === 0) {
    return <p role="alert">Sample remedies unavailable. Start and seed the local Firestore emulator.</p>;
  }
  if (!remedies) return <p role="status">Reading sample remedies from Firestore…</p>;

  return (
    <section className="coming-soon-card" aria-labelledby="sample-title">
      <h2 id="sample-title">Firestore samples</h2>
      {remedies.map(remedy => (
        <article key={remedy.id}>
          <h3>{remedy.name}</h3>
          <p>{remedy.summary}</p>
          <p>Ingredients: {remedy.ingredients.join(', ')}</p>
          <p>Health goal: {remedy.goals.map(goal => goal.name).join(', ')}</p>
          {remedy.origins.map(origin => (
            <p key={origin.id}>
              Continents: {origin.continents.join(', ') || 'Unspecified'}. <a href={origin.sourceUrl}>Origin source</a>
            </p>
          ))}
          <p>Studies: {remedy.studies.length}</p>
          <ul>
            {remedy.studies.map(study => (
              <li key={study.id}>
                <a href={study.sourceUrl}>{study.title}</a> · {study.participantsAnalyzed} analyzed across all study groups
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
