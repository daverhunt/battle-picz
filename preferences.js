(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.BattlePiczPreferences = api.BattlePiczPreferences;
    root.battlePiczPreferences = new api.BattlePiczPreferences(root.localStorage);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SOUND_KEY = 'battle-picz.settings.sound';
  const ROUND_DETAIL_KEY = 'battle-picz.settings.round-detail';
  const NOTIFICATIONS_KEY = 'battle-picz.settings.notifications';

  class BattlePiczPreferences {
    constructor(storage) {
      this.storage = storage;
    }

    readBoolean(key, fallback) {
      const value = this.storage?.getItem(key);
      if (value == null) return fallback;
      return value === 'true';
    }

    writeBoolean(key, value) {
      const next = Boolean(value);
      this.storage?.setItem(key, String(next));
      return next;
    }

    get soundEnabled() {
      return this.readBoolean(SOUND_KEY, true);
    }

    set soundEnabled(value) {
      this.writeBoolean(SOUND_KEY, value);
    }

    get roundDetail() {
      return this.readBoolean(ROUND_DETAIL_KEY, false);
    }

    set roundDetail(value) {
      this.writeBoolean(ROUND_DETAIL_KEY, value);
    }

    get notificationsEnabled() {
      return this.readBoolean(NOTIFICATIONS_KEY, true);
    }

    set notificationsEnabled(value) {
      this.writeBoolean(NOTIFICATIONS_KEY, value);
    }
  }

  return { BattlePiczPreferences, SOUND_KEY, ROUND_DETAIL_KEY, NOTIFICATIONS_KEY };
});
