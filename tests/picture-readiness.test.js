const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('next round restores the board and keeps inputs/timer paused until the picture has loaded', async()=>{
  let ready, introRuns=0, removed=[];
  const loaded=new Promise(r=>ready=r);
  const node={classList:{remove:()=>{}},style:{},textContent:''};
  const context={pictureLoadVersion:0, intro:false, performance:{now:()=>10000},
    document:{querySelector:()=>({classList:{remove:(...v)=>removed.push(...v)}}),querySelectorAll:()=>[]},
    $:()=>node, makePool:()=>[], q:()=>({cat:'FOOD'}), difficulty:{label:'Easy'},qi:0,roundResults:[],
    positionPicture:()=>loaded,grid:()=>{},letters:()=>{},ans:()=>{},saveProgress:()=>{},
    runIntro:()=>{introRuns++},requestAnimationFrame:fn=>fn()};
  vm.createContext(context);
  const code=html.slice(html.indexOf('      async function startQ(saved)'),html.indexOf('      let resultActions'));
  vm.runInContext(code,context);
  const pending=context.startQ();
  assert.equal(context.intro,true);
  assert.ok(removed.includes('slide-out'));
  assert.equal(introRuns,0);
  ready(); await pending;
  assert.equal(introRuns,1);
  assert.equal(context.start,10000);
});
