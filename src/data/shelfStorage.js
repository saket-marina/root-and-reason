const REMEDIES_KEY = 'savedRemedies';
const COMPARISONS_KEY = 'savedComparisons';
const SHELF_KEY = 'remedyShelf';

function readItems(key) {
  try {
    const stored = localStorage.getItem(SHELF_KEY);
    const items = stored === null
      ? JSON.parse(localStorage.getItem(key) || '[]')
      : JSON.parse(stored)?.[key];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveShelf(shelf) {
  try {
    // One write keeps remedies and comparisons together if storage is full.
    localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
  } catch {
    return false;
  }

  try {
    localStorage.removeItem(REMEDIES_KEY);
    localStorage.removeItem(COMPARISONS_KEY);
  } catch {
    // The new record is saved; older keys are no longer used.
  }
  window.dispatchEvent(new Event('remedy-shelf-change'));
  return true;
}

function saveItems(key, items) {
  return saveShelf({
    [REMEDIES_KEY]: getSavedRemedies(),
    [COMPARISONS_KEY]: getSavedComparisons(),
    [key]: items,
  });
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
  return saveShelf({ [REMEDIES_KEY]: [], [COMPARISONS_KEY]: [] });
}
