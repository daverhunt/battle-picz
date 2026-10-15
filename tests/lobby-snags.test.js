const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ui=fs.readFileSync(require('node:path').join(__dirname,'../multiplayer-ui.js'),'utf8');
const ctx={opponentAvatar:()=>'',opponentName:()=> 'Opponent',relativeTime:()=> 'Now',escapeHtml:s=>s};
vm.createContext(ctx);
vm.runInContext(ui.slice(ui.indexOf('  function cardStatus'),ui.indexOf('  function emptyMessage')),ctx);
const item={id:'m',match:{},opponent:{},bucket:'your-turn',action:'result',currentRound:2,resultRound:2,myRoundsWon:0,theirRoundsWon:2,roundConfig:{category:'FOOD'}};
test('unread result cards contain neither player scores nor winner styling',()=>{
 const card=ctx.renderCard(item);
 assert.match(card,/RESULTS READY/);
 assert.doesNotMatch(card,/You <b>|Them <b>|result-won|result-lost/);
});
test('viewed results may show scores and early waiting cards have no nudge control',()=>{
 const card=ctx.renderCard({...item,resultRound:0,action:'waiting',bucket:'waiting',canNudge:false});
 assert.match(card,/Them <b>2/);
 assert.doesNotMatch(card,/data-action="nudge"|NUDGED/);
});
test('eligible waiting cards offer a nudge',()=>{
 assert.match(ctx.renderCard({...item,resultRound:0,action:'waiting',bucket:'waiting',canNudge:true}),/data-action="nudge"/);
});
