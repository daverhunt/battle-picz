"""Fetch starter catalogue candidates for review from Wikipedia/Commons; retain licensing metadata."""
import json,urllib.request,urllib.parse,concurrent.futures,time,pathlib,subprocess,re,html
packs={
'OBJECTS':['Umbrella','Clock','Scissors','Key','Camera','Telephone','Book','Candle','Chair','Spoon'],
'TRANSPORT':['Bicycle','Motorcycle','Bus','Train','Helicopter','Airplane','Tram','Tractor','Sailboat','Submarine'],
'LANDMARKS':['Eiffel Tower','Big Ben','Taj Mahal','Colosseum','Stonehenge','Statue of Liberty','Tower Bridge','Leaning Tower of Pisa','Great Sphinx of Giza','Sydney Opera House'],
'MUSIC':['Guitar','Piano','Violin','Trumpet','Saxophone','Flute','Harp','Accordion','Drum kit','Clarinet'],
'PLANTS':['Rose','Sunflower','Tulip','Daisy','Daffodil','Orchid','Cactus','Bamboo','Fern','Dandelion'],
'TOOLS':['Hammer','Screwdriver','Spanner','Pliers','Handsaw','Drill','Wheelbarrow','Ladder','Axe','Shovel'],
'JOBS':['Firefighter','Chef','Dentist','Farmer','Astronaut','Baker','Barber','Welder','Police officer','Lifeguard'],
'SPACE':['Moon','Saturn','Jupiter','Mars','Sun','Comet','Galaxy','Nebula','Solar eclipse','Space Shuttle'],
'CLOTHING':['Hat','Scarf','Glove','Shoe','Boot','Sock','Jeans','Dress','Necktie','Belt (clothing)']}
labels={'Great Sphinx of Giza':'SPHINX','Leaning Tower of Pisa':'TOWER OF PISA','Statue of Liberty':'STATUE OF LIBERTY','Sydney Opera House':'SYDNEY OPERA HOUSE','Drum kit':'DRUMS','Belt (clothing)':'BELT','Police officer':'POLICE','Solar eclipse':'ECLIPSE'}
def get(url):
 for attempt in range(3):
  try:
   result=subprocess.run(['curl','-fsSL','-A','BattlePicz/1.0 (https://battle-picz-game.vercel.app/; educational picture-game attribution importer)','--max-time','20',url],capture_output=True,check=True)
   return json.loads(result.stdout)
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def item(args):
 cat,term=args
 try:
  d=get('https://en.wikipedia.org/api/rest_v1/page/summary/'+urllib.parse.quote(term.replace(' ','_')))
  img=d.get('thumbnail',{}).get('source')
  if not img or '/commons/' not in img:raise ValueError('No Commons image')
  original=d.get('originalimage',{}).get('source','')
  filename=urllib.parse.unquote(original.split('?')[0].split('/')[-1])
  meta=get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'extmetadata','titles':'File:'+filename}))
  page=next(iter(meta['query']['pages'].values()))
  ext=page['imageinfo'][0]['extmetadata']
  license=ext.get('LicenseShortName',{}).get('value','')
  if not any(x in license.lower() for x in ['cc0','public domain','cc by','cc-by']):raise ValueError('Unsupported license '+license)
  label=labels.get(term,term).upper(); answer=''.join(c for c in label if c.isalpha())
  if len(answer)>16:raise ValueError('Answer too long')
  return cat,{'id':cat.lower()+':'+answer.lower(),'a':answer,'label':label,'pic':'🖼️','image':img.split('?')[0],'source':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(filename),'license':license,'licenseUrl':ext.get('LicenseUrl',{}).get('value',''),'artist':html.unescape(re.sub('<[^>]+>', '', ext.get('Artist',{}).get('value',''))),'gt':7000,'gs':3800},None
 except Exception as e:return cat,None,term+': '+str(e)
dest=pathlib.Path('docs/starter-image-sources.json')
out=json.loads(dest.read_text()) if dest.exists() else {k:[] for k in packs};errors=[]
known={q['id'] for v in out.values() for q in v}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for cat,q,error in pool.map(item,[(c,t) for c,terms in packs.items() for t in terms if t not in {'Hammer','Sun','Harp'} and c.lower()+':' +''.join(x for x in labels.get(t,t).lower() if x.isalpha()) not in known]):
  if q:out[cat].append(q)
  else:errors.append(error)
  print(cat, q['a'] if q else error, flush=True)
  pathlib.Path('docs/starter-image-sources.json').write_text(json.dumps(out,indent=2))
pathlib.Path('docs/starter-image-sources.json').write_text(json.dumps(out,indent=2))
print(json.dumps({'counts':{c:len(q) for c,q in out.items()},'errors':errors},indent=2))
