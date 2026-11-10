import { validateCatalog } from './remedyCatalog.js';
import { loadFirestoreCatalog } from './firestoreCatalog.js';

export async function fetchRemedyCatalog(signal) {
  const data = await loadFirestoreCatalog(signal);

  return {
    catalog: validateCatalog(data),
    reference: false,
  };
}

export function findRemediesForGoal(catalog, goalId) {
  return catalog.remedies.filter((remedy) => remedy.goalIds.includes(goalId));
}

export function searchCatalog(catalog, text) {
  const query = text.trim().toLowerCase();
  if (!query) return { kind: 'browse', goals: [], remedies: [], suggestions: [] };
  const hasQuery = (value) => value.toLowerCase().includes(query);
  const terms = (remedy) => [remedy.name, ...(remedy.searchTerms || [])];
  const goals = catalog.goals.filter((goal) => hasQuery(goal.name));
  const remedies = catalog.remedies.filter((remedy) => terms(remedy).some(hasQuery)
    || remedy.goalIds.some((id) => goals.some((goal) => goal.id === id)));
  const exact = goals.some((goal) => goal.name.toLowerCase() === query)
    || remedies.some((remedy) => terms(remedy).some((term) => term.toLowerCase() === query));
  return {
    kind: !goals.length && !remedies.length ? 'none' : exact ? 'exact' : 'partial',
    goals, remedies,
    suggestions: [...new Set([...goals.map((goal) => goal.name), ...remedies.map((remedy) => remedy.name)])].slice(0, 6),
  };
}
