(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BattlePiczProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = 1;
  const PREFIX = 'battle-picz.progress.';

  function key(matchId, roundNo) {
    if (!matchId) return '';
    return `${PREFIX}${matchId}.${Number(roundNo) || 1}`;
  }

  function save(storage, matchId, roundNo, state) {
    const storageKey = key(matchId, roundNo);
    if (!storage || !storageKey || !state) return false;
    storage.setItem(storageKey, JSON.stringify({
      version: VERSION,
      matchId,
      roundNo: Number(roundNo) || 1,
      savedAt: Date.now(),
      state
    }));
    return true;
  }

  function load(storage, matchId, roundNo) {
    const storageKey = key(matchId, roundNo);
    if (!storage || !storageKey) return null;
    try {
      const value = JSON.parse(storage.getItem(storageKey));
      if (value?.version !== VERSION || value.matchId !== matchId ||
          value.roundNo !== (Number(roundNo) || 1) || !value.state) return null;
      return value.state;
    } catch {
      return null;
    }
  }

  function clear(storage, matchId, roundNo) {
    const storageKey = key(matchId, roundNo);
    if (storage && storageKey) storage.removeItem(storageKey);
  }

  return { VERSION, key, save, load, clear };
});
