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
    assert.match(h,/pic-rivals-wordmark-final\.webp/);
    assert.ok(h.indexOf('pic-header-brand')<h.indexOf('pic-header-actions'));
  }
  assert.match(css,/flex-direction:row!important/);
  assert.match(css,/height:70px!important/);
  assert.match(css,/@media\(max-width:340px\)/);
});
test('category header keeps coins and logo but omits shop and settings',()=>{
  const category=game.split('<div class="category-topbar pic-screen-header"')[1].split('<h2 id="chooserTitle"')[0];
  const lobbyHeader=lobby.split('<header class="matches-header pic-screen-header"')[1].split('</header>')[0];
  assert.match(category,/id="categoryTopCoins"/);
  assert.match(category,/category-add-coins/);
  assert.doesNotMatch(category,/category-shop|category-settings/);
  assert.match(lobbyHeader,/matches-shop/);
  assert.match(lobbyHeader,/matches-settings/);
  assert.ok(lobby.includes(".category-add-coins')?.addEventListener('click'"));
});
test('game wordmark remains outside the scoreboard',()=>{
  assert.match(game,/game-brand-wordmark[^\n]*\n\s*<div class="header">/);
  assert.match(css,/#game>\.header\{top:5\.8%!important\}/);
});

test('category title, options, and difficulty stay inside the category chooser DOM',()=>{
  // HTML nesting regression: count elements between chooser open and its title.
  // A stray closing div previously closed the chooser before this heading.
  const section=game.slice(game.indexOf('<div class="category-chooser"'),game.indexOf('<div class="result-actions"'));
  assert.ok(section.startsWith('<div class="category-chooser"'));
  let depth=0;
  for(const tag of section.match(/<\/?div\b[^>]*>|<h2\b[^>]*>/g)||[]){
    if(tag.startsWith('<h2')) {
      assert.equal(depth,1,'chooserTitle must have categoryChooser as its open parent');
      break;
    }
    depth+=tag.startsWith('</')?-1:1;
    assert.ok(depth>=1,'categoryChooser must not close before the heading');
  }
  assert.match(section, /id="categoryOptions"/);
  assert.match(section, /id="difficultyOptions"/);
  const beforeOptions=section.split('id="categoryOptions"')[0];
  assert.match(beforeOptions, /id="chooserTitle"/);
});
