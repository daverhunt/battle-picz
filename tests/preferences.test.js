const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BattlePiczPreferences,
  SOUND_KEY,
  ROUND_DETAIL_KEY,
  NOTIFICATIONS_KEY
} = require('../preferences.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

test('uses friendly defaults for a new install', () => {
  const preferences = new BattlePiczPreferences(memoryStorage());
  assert.equal(preferences.soundEnabled, true);
  assert.equal(preferences.roundDetail, false);
  assert.equal(preferences.notificationsEnabled, true);
});

test('persists sound, score display and notification choices', () => {
  const storage = memoryStorage();
  const preferences = new BattlePiczPreferences(storage);
  preferences.soundEnabled = false;
  preferences.roundDetail = true;
  preferences.notificationsEnabled = false;
  assert.equal(storage.getItem(SOUND_KEY), 'false');
  assert.equal(storage.getItem(ROUND_DETAIL_KEY), 'true');
  assert.equal(storage.getItem(NOTIFICATIONS_KEY), 'false');
  const restored = new BattlePiczPreferences(storage);
  assert.equal(restored.soundEnabled, false);
  assert.equal(restored.roundDetail, true);
  assert.equal(restored.notificationsEnabled, false);
});
