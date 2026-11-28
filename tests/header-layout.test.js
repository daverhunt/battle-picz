const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lobby = fs.readFileSync(path.join(__dirname, '../multiplayer-ui.js'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../playroom.css'), 'utf8');

test('lobby and categories share the same two-row branded header', () => {
  assert.match(lobby, /matches-header pic-screen-header/);
  assert.match(game, /category-topbar pic-screen-header/);
  for (const source of [lobby, game]) {
    assert.match(source, /pic-header-brand/);
    assert.match(source, /pic-header-bottom/);
    assert.match(source, /pic-rivals-wordmark-final\.webp/);
  }
  assert.match(css, /grid-template-rows:54px 44px!important/);
  assert.match(css, /width:min\(224px,65vw\)!important/);
});

test('logo does not share control row, and gameplay logo is outside scoreboard', () => {
  const header = lobby.split('<header class="matches-header pic-screen-header">')[1].split('</header>')[0];
  const brand = header.split('pic-header-brand')[1].split('pic-header-bottom')[0];
  assert.doesNotMatch(brand, /matches-balance|matches-settings|matches-shop/);
  const category = game.split('<div class="category-topbar pic-screen-header">')[1].split('</div>\n        <h2')[0];
  assert.match(category, /category-topbalance/);
  assert.match(game, /game-brand-wordmark[^\n]*\n\s*<div class="header">/);
  assert.match(css, /#game>\.header\{top:5\.8%!important\}/);
  assert.match(css, /#game>\.qtimers\{top:18%!important\}/);
});
