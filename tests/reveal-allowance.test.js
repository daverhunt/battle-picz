const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('hard limit blocks tile opening and prompts power-ups; Bomb credit does not consume allowance',()=>{
 const code=html.slice(html.indexOf('          b.onclick = () => {',html.indexOf('      function grid()')),html.indexOf('          g.appendChild(b)',html.indexOf('      function grid()')));
 for(const [used,free,blocked] of [[7,0,true],[6,0,false],[10,3,true],[9,3,false]]){
  let opened=0,hints=0,saves=0;
  const c={b:{classList:{contains:()=>false,add:()=>opened++}},intro:false,ended:false,rev:used,freeBombReveals:free,difficulty:{reveals:7},highlightPowerUps:()=>hints++,window:{},renderRevealAllowance(){},saveProgress:()=>saves++};
  vm.runInNewContext(code,c);c.b.onclick();
  assert.equal(opened,blocked?0:1);assert.equal(hints,blocked?1:0);assert.equal(saves,blocked?0:1);assert.equal(c.rev,used+(blocked?0:1));
 }
});
