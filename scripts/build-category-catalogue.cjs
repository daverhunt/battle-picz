// Keep legacy banks unchanged: old rounds depend on their order and contents.
const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('questions.js','utf8'),context);
const legacy=context.window.BATTLE_PICZ_QUESTIONS;
const added=JSON.parse(fs.readFileSync('docs/starter-image-sources.json','utf8'));
for(const [category,questions] of Object.entries(added)) {
 if(questions.length<3)throw Error(category+' needs at least three reviewed pictures');
 if(legacy[category])throw Error('Do not change legacy bank '+category);
 for(const q of questions) if(!fs.existsSync(q.image))throw Error('Missing picture '+q.image);
}
fs.writeFileSync('category-pictures.js','// Licensed starter packs; see docs/starter-image-sources.json for attribution.\nObject.assign(window.BATTLE_PICZ_QUESTIONS, '+JSON.stringify(added)+');\n');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const rows=Object.entries({...legacy,...added}).flatMap(([cat,qs])=>qs.map(q=>{
 const id=q.id||cat.toLowerCase()+':'+q.a.toLowerCase();
 return '('+[id,cat,JSON.stringify({...q,id})].map(quote).join(',')+'::jsonb)';
}));
const sql='-- Versioned catalogue, including the original thirty pictures.\ninsert into public.category_pictures(id,category_id,question) values\n'+rows.join(',\n')+'\non conflict(id) do update set question=excluded.question;\n';
const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_category_picture_catalogue.sql'));
fs.writeFileSync('supabase/migrations/'+migration,sql);
console.log('Catalogue: '+rows.length+' pictures, '+Object.keys({...legacy,...added}).length+' categories');
