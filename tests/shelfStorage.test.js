import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  clearShelf, getSavedComparisons, getSavedRemedies,
  removeSavedComparison, removeSavedRemedy, saveComparison, saveRemedy,
} from '../src/data/shelfStorage.js';

const originalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;
const comparison = {
  id: 'constipation:green-kiwifruit|prunes',
  remedyIds: ['green-kiwifruit', 'prunes'],
  goalId: 'constipation',
};
let values, writes, changes, failWrites;

beforeEach(() => {
  values = new Map([
    ['savedRemedies', JSON.stringify(['green-kiwifruit'])],
    ['savedComparisons', JSON.stringify([comparison])],
    ['rr-disclaimer-accepted', 'true'],
  ]);
  writes = 0;
  changes = 0;
  failWrites = false;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem(key, value) {
      writes++;
      if (failWrites || writes > 1) throw new Error('Storage unavailable');
      values.set(key, value);
    },
  };
  globalThis.window = new EventTarget();
  window.addEventListener('remedy-shelf-change', () => changes++);
});

afterEach(() => {
  globalThis.localStorage = originalStorage;
  globalThis.window = originalWindow;
});

test('existing saved items can be read without rewriting them', () => {
  assert.deepEqual(getSavedRemedies(), ['green-kiwifruit']);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  assert.equal(writes, 0);
});

test('saving an item carries both existing lists forward', () => {
  assert.equal(saveRemedy('prunes'), true);
  assert.deepEqual(getSavedRemedies(), ['green-kiwifruit', 'prunes']);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  assert.equal(changes, 1);
  assert.equal(values.has('savedRemedies'), false);
  assert.equal(values.has('savedComparisons'), false);
});

test('clear succeeds even when storage only allows one write', () => {
  assert.equal(clearShelf(), true);
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), []);
  assert.equal(changes, 1);
  assert.equal(values.get('rr-disclaimer-accepted'), 'true');
});

test('a failed clear leaves both lists intact', () => {
  failWrites = true;
  assert.equal(clearShelf(), false);
  assert.deepEqual(getSavedRemedies(), ['green-kiwifruit']);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  assert.equal(changes, 0);
});

test('cleanup failure does not hide a successful clear', () => {
  localStorage.removeItem = () => { throw new Error('Cleanup blocked'); };
  assert.equal(clearShelf(), true);
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), []);
  assert.equal(changes, 1);
});

test('older entries stay cleared on subsequent reads and saves', () => {
  assert.equal(clearShelf(), true);
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), []);
  writes = 0;
  assert.equal(saveRemedy('prunes'), true);
  assert.deepEqual(getSavedRemedies(), ['prunes']);
  assert.deepEqual(getSavedComparisons(), []);
});

test('failed updates preserve both lists and do not signal success', () => {
  failWrites = true;
  assert.equal(saveRemedy('prunes'), false);
  assert.equal(removeSavedRemedy('green-kiwifruit'), false);
  assert.equal(removeSavedComparison(comparison.id), false);
  assert.deepEqual(getSavedRemedies(), ['green-kiwifruit']);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  assert.equal(changes, 0);
});

test('remedy and comparison duplicates are still prevented', () => {
  assert.equal(saveRemedy('green-kiwifruit'), true);
  assert.equal(saveComparison(['prunes', 'green-kiwifruit'], 'constipation'), true);
  assert.equal(saveComparison(['prunes', 'prunes'], 'constipation'), false);
  assert.deepEqual(getSavedRemedies(), ['green-kiwifruit']);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  assert.equal(writes, 0);
});

test('removing one item preserves the other list', () => {
  assert.equal(removeSavedRemedy('green-kiwifruit'), true);
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), [comparison]);
  writes = 0;
  assert.equal(removeSavedComparison(comparison.id), true);
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), []);
});

test('a corrupt older list does not hide the other saved items', () => {
  values.set('savedRemedies', '{broken');
  assert.deepEqual(getSavedRemedies(), []);
  assert.deepEqual(getSavedComparisons(), [comparison]);
});
