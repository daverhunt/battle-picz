const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('all twelve packs have playable, distinct answers and existing picture assets',()=>{
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync('questions.js','utf8'),ctx);vm.runInNewContext(fs.readFileSync('category-pictures.js','utf8'),ctx);
 const banks=ctx.window.BATTLE_PICZ_QUESTIONS;assert.equal(Object.keys(banks).length,12);
 for(const [category,qs] of Object.entries(banks)){
  assert.ok(qs.length>=3,category);assert.equal(new Set(qs.map(q=>q.a)).size,qs.length,category);
  for(const q of qs){assert.match(q.a,/^[A-Z]{2,16}$/);assert.ok(fs.existsSync(q.image),q.image);if(q.id){assert.ok(q.source.startsWith('https://commons.wikimedia.org/wiki/File:'));assert.ok(q.license);}}
 }
});
