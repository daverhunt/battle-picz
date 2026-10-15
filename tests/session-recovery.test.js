const test = require('node:test');
const assert = require('node:assert/strict');
const { BattlePiczBackend, SESSION_KEY } = require('../multiplayer');
function setup(fetchImpl) {
  const saved = {access_token:'old', refresh_token:'refresh', expires_at:1, user:{id:'same-player'}};
  const values = new Map([[SESSION_KEY, JSON.stringify(saved)]]);
  const storage = {getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)};
  return {saved, backend:new BattlePiczBackend({url:'https://example.test',publishableKey:'public',storage,fetchImpl})};
}
test('offline refresh retains identity and successful retry restores the same player', async () => {
  let offline = true;
  const urls=[];
  const {saved, backend} = setup(async url => {
    urls.push(url);
    if (offline) throw new TypeError('Failed to fetch');
    return {ok:true,text:async()=>JSON.stringify({...saved,access_token:'new',expires_at:9999999999})};
  });
  await assert.rejects(backend.ensureSession(), /Connection lost/);
  assert.deepEqual(backend.readSession(),saved);
  offline=false;
  assert.equal((await backend.ensureSession()).user.id,'same-player');
  assert.ok(urls.every(url=>url.includes('refresh_token')));
});
test('parallel expired-session requests share one refresh token exchange', async () => {
  let calls=0, release;
  const gate=new Promise(r=>release=r);
  const {saved,backend}=setup(async()=>{calls++; await gate; return {ok:true,text:async()=>JSON.stringify({...saved,expires_at:9999999999})};});
  const requests=[backend.ensureSession(),backend.ensureSession(),backend.recoverSession()];
  release();
  await Promise.all(requests);
  assert.equal(calls,1);
});
test('Google recovery sign-in does not depend on a broken guest session', async()=>{
  const {backend}=setup(async()=>{throw new Error('must not refresh');});
  const url=await backend.beginOAuth('google',{link:false,redirectTo:'https://game.test/'});
  assert.match(url,/\/authorize\?/);
  assert.equal(backend.readPendingAuth().mode,'signin');
});
test('six-hour nudge delay starts over when the next player turn begins',()=>{
  const now=Date.now(), iso=age=>new Date(now-age).toISOString(), hours=3600000;
  const match={id:'m', status:'active', created_at:iso(24*hours), started_at:iso(24*hours),game_config:{rounds:{'1':{category:'FOOD'}}}};
  const players=[{user_id:'me',player_no:1,accepted_at:iso(24*hours)},{user_id:'them',player_no:2,accepted_at:iso(24*hours)}];
  const turn={user_id:'me',round_no:1,score:1,completed_at:iso(5*hours)};
  assert.equal(BattlePiczBackend.describeMatch(match,players,[turn],'me').canNudge,false);
  assert.equal(BattlePiczBackend.describeMatch(match,players,[{...turn,completed_at:iso(6*hours+100)}],'me').canNudge,true);
  assert.equal(BattlePiczBackend.describeMatch(match,players,[turn],'them').canNudge,false);
});
