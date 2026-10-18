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
