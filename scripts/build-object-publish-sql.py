#!/usr/bin/env python3
"""Prepare reviewed/available Objects photo records for Supabase. Does not apply them."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'docs/objects-next-81.json').read_text())['items']
metadata_path=ROOT/'docs/objects-next-81-sources.json'
sources=json.loads(metadata_path.read_text()).get('items',{}) if metadata_path.exists() else {}
def sqlquote(v):
    return "'" + str(v).replace("'","''") + "'"
rows=[]
for item in catalog:
    path=ROOT/item['image']
    source=sources.get(item['slug'])
    if not source or not path.exists() or path.stat().st_size<1000: continue
    # Filename similarity alone can match roads, surnames and landmarks instead
    # of the actual object. Only activate concept-backed depictions automatically.
    if source.get('quality') not in ('wikidata-depicts','curated-photo'): continue
    if not source.get('license') or not source.get('source'): continue
    answer=item['answer'].upper()
    question={'id':item['id'],'a':answer,'label':answer,
              'image':item['image'],'pic':'🖼️',
              'gt':7000,'gs':3800,
              'source':source['source'],'license':source['license'],
              'licenseUrl':source.get('licenseUrl',''),
              'artist':source.get('artist',''),
              'modifications':source.get('modifications','Resized and converted to WebP')}
    rows.append('('+sqlquote(item['id'])+", 'OBJECTS', "+
                sqlquote(json.dumps(question,ensure_ascii=False))+'::jsonb, true)')
lines=['-- Photo-backed, openly licensed Objects pictures ONLY.',
       '-- Generated from real image files; review source credits before applying.',
       '-- Existing 19 picture records are never modified.',
       f'-- Ready: {len(rows)}/{len(catalog)} additional images.']
if rows:
    lines+=['insert into public.category_pictures(id,category_id,question,active) values',
            ',\n'.join(rows),
            'on conflict (id) do nothing;']
(ROOT/'docs/objects-next-81-publish.sql').write_text('\n'.join(lines)+'\n')
print(f"Prepared {len(rows)} new Objects database entries.")
