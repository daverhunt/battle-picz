const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
 const events={}, voices=[]; let now=0, created=0;
 const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 class Audio {
  constructor(){created++;this.currentTime=0;this.state='running';}
  createGain(){return {gain:{...param},connect(){},disconnect(){}};}
  createOscillator(){const o={frequency:param,connect(){},disconnect(){},start(){},stop(){o.stops=(o.stops||0)+1;}};voices.push(o);return o;}
  resume(){this.state='running';return Promise.resolve();} suspend(){this.state='suspended';return Promise.resolve();}
 }
 const window={AudioContext:Audio,battlePiczPreferences:{soundEnabled:true},addEventListener:(k,v)=>events[k]=v};
 const document={hidden:false,addEventListener:(k,v)=>events[k]=v};
 vm.runInNewContext(fs.readFileSync('sounds.js','utf8'),{window,document,performance:{now:()=>now},Math,Set,Map});
 return {api:window.battlePiczSound,window,document,events,voices,advance:()=>now+=1000,created:()=>created};
}
test('audio requires gesture, honours mute and tolerates unavailable Web Audio',()=>{
 const h=harness();h.api.play('tile');assert.equal(h.created(),0);
 h.events.pointerdown();h.api.play('tile');assert.equal(h.voices.length,1);
 h.window.battlePiczPreferences.soundEnabled=false;h.events['battle-picz:settings-changed']();
 assert.equal(h.voices[0].stops,2);h.advance();h.api.play('correct');assert.equal(h.voices.length,1);
 const no=harness();delete no.window.AudioContext;assert.doesNotThrow(()=>{no.api.unlock();no.api.play('tile');});
});
test('pause and background stop scheduled sounds; rapid tile bursts are bounded',()=>{
 const h=harness();h.api.unlock();h.api.play('correct');assert.equal(h.voices.length,3);
 h.api.setPaused(true);assert.ok(h.voices.every(x=>x.stops===2));h.api.play('tile');assert.equal(h.voices.length,3);
 h.api.setPaused(false);h.advance();for(let i=0;i<20;i++)h.api.play('tile');assert.equal(h.voices.length,4);
 h.document.hidden=true;h.events.visibilitychange();h.advance();h.api.play('won');assert.equal(h.voices.length,4);
 h.document.hidden=false;h.events.visibilitychange();h.api.play('letter');assert.equal(h.voices.length,5);
});
test('coin clinks and ghost score cues are distinct and respect mute',()=>{
 const h=harness();h.api.unlock();h.api.play('coin');
 assert.equal(h.voices.length,2);assert.ok(h.voices.every(v=>v.type==='sine'));
 h.advance();h.api.play('ghost-score');assert.equal(h.voices.length,4);
 assert.ok(h.voices.slice(2).every(v=>v.type==='triangle'));
 h.window.battlePiczPreferences.soundEnabled=false;h.advance();h.api.play('coin');h.api.play('ghost-score');
 assert.equal(h.voices.length,4);
});
