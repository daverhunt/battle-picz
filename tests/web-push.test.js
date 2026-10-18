const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('push worker displays a generic notification for malformed payload and blocks external click destinations', async () => {
 const handlers = {}, shown = [], opened = [];
 const self = { location: {origin:'https://game.test'}, addEventListener:(n,f)=>handlers[n]=f,
  registration:{showNotification: async (...a)=>shown.push(a)}, clients:{matchAll:async()=>[],openWindow:async u=>opened.push(u)} };
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'), {self,URL});
 let promise;
 handlers.push({data:{json(){throw Error('bad')}},waitUntil:p=>promise=p}); await promise;
 assert.equal(shown[0][0],'Battle Picz');
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test/'}},waitUntil:p=>promise=p});await promise;
 assert.equal(opened[0],'https://game.test/');
});

test('permission alone never marks alerts enabled when backend registration fails', async () => {
 const handlers={}, rpcCalls=[];
 const sub={endpoint:'https://web.push.apple.com/test',toJSON(){return {endpoint:this.endpoint,keys:{}}}};
 const reg={pushManager:{getSubscription:async()=>sub}};
 const window={Notification:{permission:'granted',requestPermission:async()=> 'granted'},PushManager:{},
  battlePiczPreferences:{notificationsEnabled:false},battlePiczBackend:{readSession:()=>({user:{id:'a'}}),rpc:async(name)=>{rpcCalls.push(name);if(name==='web_push_public_key')return 'BAAA';throw Error('Network unavailable');}},
  dispatchEvent(){},addEventListener:(n,f)=>handlers[n]=f};
 const context={window,Notification:window.Notification,navigator:{serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg)},userAgent:'Chrome'},matchMedia:()=>({matches:false}),atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,CustomEvent:class{}};
 vm.runInNewContext(fs.readFileSync('push.js','utf8'), context);
 await assert.rejects(window.BattlePiczPush.enable(),/Network unavailable/);
 assert.equal(window.BattlePiczPush.enabled,false);
 assert.equal(window.battlePiczPreferences.notificationsEnabled,false);
 assert.ok(rpcCalls.includes('register_web_push'));
});

for (const currentUrl of ['https://game.test/', 'https://game.test/?matchId=one&screen=results&round=2']) {
 test(`notification navigates an existing app before focusing: ${currentUrl}`, async () => {
  const handlers={}, calls=[];
  const target='https://game.test/?matchId=one&screen=results&round=2';
  const client={url:currentUrl,navigate:async url=>{calls.push(['navigate',url]);return client;},focus:async()=>calls.push(['focus'])};
  const self={location:{origin:'https://game.test'},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[client],openWindow:async()=>{throw Error('Should reuse app');}}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,URL});
  let promise;handlers.notificationclick({notification:{close(){},data:{url:target}},waitUntil:p=>promise=p});await promise;
  assert.deepEqual(calls,[['navigate',target],['focus']]);
 });
}

const uiSource=fs.readFileSync('multiplayer-ui.js','utf8');
const initialise=uiSource.slice(uiSource.indexOf('  async function initialiseMatch()'),uiSource.indexOf('  window.battlePiczSaveRound'));
for(const [screen,round,canPlay,expected] of [['results',1,true,'result:1'],['game',2,true,'game'],['game',1,false,'result:2']]) {
 test(`notification route ${screen} round ${round}, playable=${canPlay}`, async()=>{
  const calls=[];
  const current={me:{},opponent:{},match:{status:'active'},roundResults:[{},{}],currentRound:3,canPlay,roundConfig:{},ownTurn:null};
  const context={URLSearchParams,location:{search:`?matchId=one&screen=${screen}&round=${round}`},backend:{finalizeWeeklyTournaments:async()=>{},getMatchContext:async(id,r)=>r?{...current,roundNo:r,ownTurn:{},opponentTurn:{}}:current},window:{showBattlePiczMatchResult:c=>calls.push('result:'+c.roundNo),startBattlePicz:()=>calls.push('game')},document:{querySelector:()=>null},localStorage:{getItem:()=> '0'},close:()=>{},open:()=>calls.push('lobby'),showError:e=>{throw e;}};
  vm.createContext(context);vm.runInContext(`let matchContext; ${initialise}`,context);
  await vm.runInContext('initialiseMatch()',context);
  assert.deepEqual(calls,[expected]);
 });
}

test('Google auth redirect retains a notification destination but removes auth parameters',()=>{
 const {BattlePiczBackend}=require('../multiplayer');
 const backend=new BattlePiczBackend({location:{href:'https://game.test/?match=seed&matchId=one&screen=results&round=2&code=secret#token'}});
 assert.equal(backend.authRedirectUrl(),'https://game.test/?match=seed&matchId=one&screen=results&round=2');
});
