const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(data) {
  class Element {
    constructor(){this.children=[];this.dataset={};this.isConnected=true;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
  }
  const calls=[];
  const document={createElement:()=>new Element()};
  const window={battlePiczBackend:{readSession:()=>({user:{id:'test'}}),rpc:async(name,args)=>{calls.push([name,args]);return data;}},confirm:()=>true,dispatchEvent:()=>{}};
  vm.runInNewContext(fs.readFileSync('categories.js','utf8'),{window,document,CustomEvent:class{}});
  return {window,calls,container:new Element()};
}
test('only ready packs are selectable and owned categories choose without purchase',async()=>{
 const s=setup({coins:20,categories:[{id:'FOOD',name:'Food',price:0,owned:true,pictureCount:10},{id:'SPACE',name:'Space',price:15,owned:false,pictureCount:2}]});
 let chosen;
 await s.window.BattlePiczCategories.render(s.container,id=>chosen=id);
 assert.equal(s.container.children[2].disabled,true);
 await s.container.children[1].onclick();
 assert.equal(chosen,'FOOD');assert.equal(s.calls.length,1);
});
test('insufficient coins do not send a purchase',async()=>{
 const s=setup({coins:5,categories:[{id:'SPORT',name:'Sport',price:15,owned:false,pictureCount:10}]});
 await s.window.BattlePiczCategories.render(s.container);
 await s.container.children[1].onclick();
 assert.match(s.container.children[0].textContent,/10 more coins/);assert.equal(s.calls.length,1);
});
test('purchase sends only the category identifier and reloads server prices',async()=>{
 const s=setup({coins:20,categories:[{id:'SPORT',name:'Sport',price:15,owned:false,pictureCount:10}]});
 await s.window.BattlePiczCategories.render(s.container);
 await s.container.children[1].onclick();
 assert.equal(s.calls[1][0],'purchase_category');assert.equal(JSON.stringify(s.calls[1][1]),'{"p_category":"SPORT"}');assert.equal(s.calls[2][0],'list_categories');
});
