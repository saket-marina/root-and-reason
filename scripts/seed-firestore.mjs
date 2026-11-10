import { readFile } from 'node:fs/promises';

const samples = JSON.parse(await readFile(new URL('../data/remedy-samples.json', import.meta.url), 'utf8'));
const database = 'projects/demo-root-remedy-team-m2/databases/(default)';

for (const [collection, records] of Object.entries(samples)) {
  if (new Set(records.map(record => record.id)).size !== records.length) {
    throw new Error(`Duplicate IDs in ${collection}.`);
  }
}

for (const remedy of samples.remedies) {
  for (const [collection, ids] of [
    ['healthGoals', remedy.healthGoalIds],
    ['studies', remedy.studyIds],
    ['origins', remedy.originIds],
  ]) {
    for (const id of ids) {
      if (!samples[collection].some(record => record.id === id)) {
        throw new Error(`${remedy.id} references missing ${collection}/${id}.`);
      }
    }
  }

  for (const id of remedy.studyIds) {
    const study = samples.studies.find(record => record.id === id);
    if (!remedy.healthGoalIds.includes(study.healthGoalId)) {
      throw new Error(`Study ${id} does not match a health goal for ${remedy.id}.`);
    }
  }
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  throw new Error(`Unsupported sample field: ${value}`);
}

const writes = Object.entries(samples).flatMap(([collection, records]) => records.map(record => ({
  update: {
    name: `${database}/documents/${collection}/${record.id}`,
    fields: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)])),
  },
})));

const response = await fetch(`http://127.0.0.1:8088/v1/${database}/documents:commit`, {
  method: 'POST',
  // The Firestore emulator treats this token as an admin request.
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) throw new Error(`Could not seed the local emulator: ${await response.text()}`);
console.log(`Seeded ${writes.length} Firestore sample records.`);
