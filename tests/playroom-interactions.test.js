const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function gestureHarness() {
  const source = fs.readFileSync('multiplayer-ui.js','utf8');
  const handlers = {}, calls = [];
  const context = {
    busy:false, list:{scrollTop:0,addEventListener:(name,fn)=>handlers[name]=fn},
    panel:{style:{setProperty(){},removeProperty(){}}},pullStatus:{textContent:''},
    loadMatches:async message=>calls.push(message)
  };
  vm.runInNewContext(source.slice(source.indexOf('  let pullStart = null;'),source.indexOf("  window.addEventListener('battle-picz:profile-updated'")),context);
  const touch=(x,y)=>({touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){}});
  return {handlers,calls,context,touch};
}
test('pull refresh waits for release and fires once above threshold',async()=>{
 const h=gestureHarness();h.handlers.touchstart(h.touch(0,0));h.handlers.touchmove(h.touch(0,80));
 assert.equal(h.context.pullStatus.textContent,'Release to refresh');assert.equal(h.calls.length,0);
 h.handlers.touchend();await Promise.resolve();assert.equal(h.calls.length,1);
 h.handlers.touchend();assert.equal(h.calls.length,1);
});
test('short, horizontal, cancelled, busy and scrolled gestures never refresh',()=>{
 for(const mode of ['short','horizontal','cancel','busy','scrolled']){
  const h=gestureHarness();if(mode==='busy')h.context.busy=true;if(mode==='scrolled')h.context.list.scrollTop=20;
  h.handlers.touchstart(h.touch(0,0));h.handlers.touchmove(h.touch(mode==='horizontal'?100:0,mode==='short'?20:80));
  if(mode==='cancel')h.handlers.touchcancel();h.handlers.touchend();assert.equal(h.calls.length,0,mode);
 }
});
test('countdown holds gameplay until all three seconds have elapsed',()=>{
 const source=fs.readFileSync('index.html','utf8'),timers=[],elements=[];
 const layer={replaceChildren(){},append(...children){elements.push(...children)},classList:{add(){},remove(){}}};
 const context={intro:false,roundNo:2,q:()=>({cat:'FOOD'}),$:()=>layer,document:{createElement:()=>({setAttribute(){}})},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},performance:{now:()=>5000},saveProgress(){}};
 vm.runInNewContext(source.slice(source.indexOf('      let introTimers = [];'),source.indexOf('      function storedBreak')),context);
 context.runIntro();assert.equal(context.intro,true);assert.equal(elements[1].textContent,'3');
 timers.find(x=>x.delay===1000).fn();assert.equal(elements[1].textContent,'2');assert.equal(context.intro,true);
 timers.find(x=>x.delay===2000).fn();assert.equal(elements[1].textContent,'1');assert.equal(context.intro,true);
 timers.find(x=>x.delay===3000).fn();assert.equal(context.intro,false);assert.equal(context.start,5000);
});
