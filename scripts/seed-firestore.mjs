import { readFile } from 'node:fs/promises';
import { checkRemedies } from './check-remedies.mjs';

const samples = JSON.parse(await readFile(new URL('../data/remedy-samples.json', import.meta.url), 'utf8'));
const database = 'projects/demo-root-remedy-team-m2/databases/(default)';

checkRemedies(samples);

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value && typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, firestoreValue(field)]),
    ) } };
  }
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
