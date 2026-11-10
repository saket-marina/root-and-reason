import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GROUPS = ['remedies', 'ingredients', 'conditions', 'evidenceAssessments', 'studies', 'sources'];
export const MAX_DOCUMENT_BYTES = 196608;
export const MAX_IMPORT_DOCUMENTS = 400;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const canonicalize = value => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
    : value;
export const stableStringify = value => JSON.stringify(canonicalize(value));
export const hash = value => createHash('sha256').update(stableStringify(value)).digest('hex');
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
};
export function parseArgs(args, allowedValues = [], allowedFlags = []) {
  const options = {}, positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (allowedFlags.includes(key)) { options[key] = true; continue; }
    if (!allowedValues.includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error(`Unknown option or missing value: ${arg}`);
    }
    options[key] = args[++i];
  }
  return { options, positional };
}
export const isMain = url => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
export function fail(error) { console.error(error.message); process.exitCode = 1; }

// Conservative upper bound for this JSON-only profile of Firestore values.
// Includes per-field and per-value overhead, in addition to the JSON bytes.
export function estimateFirestoreBytes(value, path = '') {
  let overhead = 0;
  const visit = item => {
    overhead += 32;
    if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        overhead += Buffer.byteLength(key, 'utf8') + 32;
        visit(child);
      }
    }
  };
  visit(value);
  return Buffer.byteLength(stableStringify(value), 'utf8') + overhead + Buffer.byteLength(path) + 1024;
}
