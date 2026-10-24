const test = require('node:test');
const assert = require('node:assert/strict');
const {preloadRound, waitForPicture} = require('../image-preloader');
function mockImages() {
 const requests=[];
 class MockImage {
  constructor(){this.naturalWidth=0;}
  set src(url){this.url=url;requests.push(this);}
  async decode(){}
  async load(){this.naturalWidth=100;await this.onload();}
 }
 return {requests,MockImage};
}
test('all downloads start immediately; first picture becomes playable without pictures 2 and 3',async()=>{
 const {requests,MockImage}=mockImages();
 const entries=preloadRound([{image:'one'},{image:'two'},{image:'three'}],MockImage);
 assert.deepEqual(requests.map(i=>i.url),['one','two','three']);
 assert.deepEqual(requests.map(i=>i.fetchPriority),['high','low','low']);
 const first=waitForPicture(entries[0]);
 await requests[0].load();assert.equal(await first,true);
 assert.equal(requests[1].naturalWidth,0);assert.equal(requests[2].naturalWidth,0);
 await requests[1].load();await requests[2].load();
 assert.equal(await waitForPicture(entries[1]),true);
 assert.equal(entries[1].image,requests[1]);
 assert.equal(requests.length,3);
});
test('decoding is awaited and an error in a later image cannot block picture 1',async()=>{
 const {requests,MockImage}=mockImages();
 const entries=preloadRound([{image:'one'},{image:'two'}],MockImage);
 let decoded; requests[0].decode=()=>new Promise(r=>decoded=r);
 let ready=false;entries[0].ready.then(()=>ready=true);
 const loading=requests[0].load();requests[1].onerror();
 await Promise.resolve();assert.equal(ready,false);
 decoded();await loading;assert.equal(await entries[0].ready,true);
 assert.equal(await entries[1].ready,false);
});
test('a slow picture times out safely without cancelling its background download',async()=>{
 const {requests,MockImage}=mockImages();
 const entries=preloadRound([{image:'one'}],MockImage);
 assert.equal(await waitForPicture(entries[0],1),false);
 await requests[0].load();assert.equal(await waitForPicture(entries[0]),true);
});
