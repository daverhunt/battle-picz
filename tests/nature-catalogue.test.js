const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Nature has 79 real individual game images with distinct answers', () => {
 const dir=path.join(__dirname,'..');
 const window={BATTLE_PICZ_QUESTIONS:{}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'category-pictures.js'),'utf8'),{window});
 const nature=window.BATTLE_PICZ_QUESTIONS.NATURE;
 assert.equal(nature.length,79);
 assert.equal(new Set(nature.map(item=>item.a)).size,79);
 assert.equal(new Set(nature.map(item=>item.image)).size,79);
 for(const item of nature){
  assert.ok(item.id.startsWith('nature:'));
  assert.ok(fs.existsSync(path.join(dir,item.image)),item.image);
  assert.ok(fs.statSync(path.join(dir,item.image)).size>1000,item.image);
 }
});
