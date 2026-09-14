const test = require('node:test');
const assert = require('node:assert/strict');
const progress = require('../game-state.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('stores progress separately for each match and round', () => {
  const storage = memoryStorage();
  progress.save(storage, 'match-a', 1, { questionIndex: 2, score: 4500 });
  progress.save(storage, 'match-a', 2, { questionIndex: 0, score: 0 });

  assert.deepEqual(progress.load(storage, 'match-a', 1), { questionIndex: 2, score: 4500 });
  assert.deepEqual(progress.load(storage, 'match-a', 2), { questionIndex: 0, score: 0 });
  assert.equal(progress.load(storage, 'match-b', 1), null);
});

test('ignores corrupt progress and clears completed rounds', () => {
  const storage = memoryStorage();
  storage.setItem(progress.key('match-a', 1), '{broken');
  assert.equal(progress.load(storage, 'match-a', 1), null);

  progress.save(storage, 'match-a', 1, { questionIndex: 1 });
  progress.clear(storage, 'match-a', 1);
  assert.equal(progress.load(storage, 'match-a', 1), null);
});
