const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BattlePiczBackend } = require('../multiplayer.js');

test('offers the next round only when a later round is actionable', () => {
  assert.deepEqual(BattlePiczBackend.nextRoundAction({
    currentRound: 2,
    canChoose: true,
    canPlay: false,
    roundConfig: null
  }, 1), { available: true, roundNo: 2, mode: 'choose' });

  assert.deepEqual(BattlePiczBackend.nextRoundAction({
    currentRound: 2,
    canChoose: false,
    canPlay: true,
    roundConfig: { category: 'SPORT', difficulty: 'medium' }
  }, 1), { available: true, roundNo: 2, mode: 'play' });

  assert.equal(BattlePiczBackend.nextRoundAction({
    currentRound: 2,
    canChoose: false,
    canPlay: false,
    roundConfig: null
  }, 1).available, false);
});

test('uses an inline coin step and never reloads to advance a round', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /roundSummary\.insertBefore\(coinReward,seeResult\)/);
  assert.match(html, /roundSummary\.appendChild\(resultActions\)/);
  assert.match(html, /seeResult\.remove\(\)/);
  assert.match(html, /await window\.battlePiczBackend\.getMatchContext\(MATCH_ID\)/);
  assert.equal(html.includes('return location.reload()'), false);
});
