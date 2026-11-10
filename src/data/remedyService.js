import { validateCatalog } from './remedyCatalog.js';

// The URL is a future integration contract; Ash's endpoint must be confirmed.
export async function fetchRemedyCatalog(signal) {
  const endpoint = import.meta.env.VITE_REMEDY_CATALOG_URL;
  if (endpoint) {
    const response = await fetch(endpoint, { signal });
    if (!response.ok) throw new Error('Could not retrieve remedy data');
    return { catalog: validateCatalog(await response.json()), reference: false };
  }
  if (import.meta.env.DEV || import.meta.env.VITE_USE_REFERENCE_CATALOG === 'true') {
    const { default: fixture } = await import('./catalog.reference.json');
    return { catalog: validateCatalog(fixture), reference: true };
  }
  throw new Error('Database connection is not configured');
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
