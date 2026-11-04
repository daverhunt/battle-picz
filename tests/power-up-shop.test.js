const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const { BattlePiczBackend } = require('../multiplayer.js');
test('empty power-ups open paused shop; stocked and inactive inputs do not', () => {
  const code = html.slice(html.indexOf('      function powerUpNeedsShop'), html.indexOf('      async function showPowerUpShop'));
  for (const [count, inactive] of [[0,false],[1,false],[0,true]]) {
    const calls=[];
    const c={intro:inactive,ended:false,powerUpBusy:false,powerUps:{bomb:count},document:{querySelector:()=>({click:()=>calls.push('pause')})},showPowerUpShop:type=>calls.push(type)};
    vm.runInNewContext(code,c);
    assert.equal(c.powerUpNeedsShop('bomb'),inactive || count===0);
    assert.deepEqual(calls,count===0 && !inactive ? ['pause','bomb'] : []);
  }
});
test('empty power-ups remain clickable and accessible', () => {
  const buttons=[0,2].map(count=>({dataset:{power:count?'remove':'bomb'},querySelector:()=>({}),classList:{toggle(){}},setAttribute(k,v){this[k]=v}}));
  const c={document:{querySelectorAll:()=>buttons},powerUps:{bomb:0,remove:2},powerUpBusy:false};
  vm.runInNewContext(html.slice(html.indexOf('      function renderPowerUps'),html.indexOf('      function readOfflinePowerUps')),c);
  c.renderPowerUps();
  assert.equal(buttons[0].disabled,false); assert.match(buttons[0]['aria-label'],/open shop/);
  c.powerUpBusy=true;c.renderPowerUps();assert.equal(buttons[0].disabled,true);
});
test('purchase sends only power-up type; price is server controlled',async()=>{
  const client=Object.create(BattlePiczBackend.prototype);
  client.rpc=async(name,args)=>{assert.equal(name,'purchase_power_up');assert.deepEqual(args,{p_power_up:'bomb'});return {coins:0,bomb:1};};
  assert.deepEqual(await client.purchasePowerUp('bomb'),{coins:0,bomb:1});
  assert.throws(()=>client.purchasePowerUp('invalid'));
});
test('inline scripts parse',()=>{
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
