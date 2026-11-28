const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lobby = fs.readFileSync(path.join(__dirname,'../multiplayer-ui.js'),'utf8');
const game = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const settings = fs.readFileSync(path.join(__dirname,'../settings-ui.js'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'../playroom.css'),'utf8');

test('design A uses matching one-row lobby and category headers',()=>{
  assert.match(lobby,/matches-header pic-screen-header/);
  assert.match(game,/category-topbar pic-screen-header/);
  for(const source of [lobby,game]){
    const h=source.includes('matches-header pic-screen-header')
      ? source.split('<header class="matches-header pic-screen-header"')[1].split('</header>')[0]
      : source.split('<div class="category-topbar pic-screen-header"')[1].split('<h2 id="chooserTitle"')[0];
    assert.match(h,/pic-header-brand/);
    assert.match(h,/pic-header-actions/);
    assert.match(h,/pic-header-wallet/);
    assert.match(h,/pic-header-add/);
    assert.match(h,/pic-header-button/);
    assert.match(h,/pic-rivals-wordmark-final\.webp/);
    assert.ok(h.indexOf('pic-header-brand')<h.indexOf('pic-header-actions'));
  }
  assert.match(css,/flex-direction:row!important/);
  assert.match(css,/height:70px!important/);
  assert.match(css,/@media\(max-width:340px\)/);
});
test('category controls reuse working lobby shop, coin and settings actions',()=>{
  assert.match(lobby,/category-shop.*addEventListener\('click'/);
  assert.match(lobby,/category-add-coins.*addEventListener\('click'/);
  assert.match(settings,/category-settings.*addEventListener\('click', openSettings\)/);
});
test('game wordmark remains outside the scoreboard',()=>{
  assert.match(game,/game-brand-wordmark[^\n]*\n\s*<div class="header">/);
  assert.match(css,/#game>\.header\{top:5\.8%!important\}/);
});
