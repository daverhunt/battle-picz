const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const ctx={};vm.runInNewContext(html.slice(html.indexOf('      function revealBonusFor'),html.indexOf('      function renderRevealAllowance')),ctx);
test('soft allowance is free up to difficulty target and penalties never go negative',()=>{
 for(const target of [7,9,11]){
  assert.equal(ctx.revealBonusFor(0,target),2000);
  assert.equal(ctx.revealBonusFor(target,target),2000);
  assert.equal(ctx.revealBonusFor(target+1,target),1750);
  assert.equal(ctx.revealBonusFor(target+100,target),0);
  assert.equal(ctx.revealBonusFor(target+3-3,target),2000);
 }
});
