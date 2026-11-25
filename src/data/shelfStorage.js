const REMEDIES_KEY = 'savedRemedies';
const COMPARISONS_KEY = 'savedComparisons';

function readItems(key) {
  try {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveItems(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event('remedy-shelf-change'));
    return true;
  } catch {
    return false;
  }
}

export function getSavedRemedies() {
  return readItems(REMEDIES_KEY).filter((id) => typeof id === 'string');
}

export function isRemedySaved(id) {
  return getSavedRemedies().includes(id);
}

export function saveRemedy(id) {
  const saved = getSavedRemedies();
  if (saved.includes(id)) return true;
  return saveItems(REMEDIES_KEY, [...saved, id]);
}

export function removeSavedRemedy(id) {
  return saveItems(REMEDIES_KEY, getSavedRemedies().filter((item) => item !== id));
}

export function getSavedComparisons() {
  return readItems(COMPARISONS_KEY).filter((item) =>
    item && typeof item.id === 'string' && Array.isArray(item.remedyIds)
  );
}

export function saveComparison(remedyIds, goalId) {
  if (remedyIds.length < 2 || remedyIds.length > 4 || !goalId) return false;
  const ids = [...new Set(remedyIds)];
  if (ids.length !== remedyIds.length) return false;
  const id = `${goalId}:${[...ids].sort().join('|')}`;
  const saved = getSavedComparisons();
  if (saved.some((item) => item.id === id)) return true;
  return saveItems(COMPARISONS_KEY, [...saved, { id, remedyIds: ids, goalId }]);
}

export function removeSavedComparison(id) {
  return saveItems(COMPARISONS_KEY, getSavedComparisons().filter((item) => item.id !== id));
}

export function clearShelf() {
  try {
    localStorage.setItem(REMEDIES_KEY, '[]');
    localStorage.setItem(COMPARISONS_KEY, '[]');
    window.dispatchEvent(new Event('remedy-shelf-change'));
    return true;
  } catch {
    return false;
  }
}
