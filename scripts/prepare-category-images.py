"""Download licensed catalogue images into the deployment; create a review sheet."""
import json,subprocess,pathlib,concurrent.futures
from PIL import Image,ImageDraw
root=pathlib.Path(__file__).resolve().parents[1]
x=json.loads((root/'docs/starter-image-sources.json').read_text())
items=[(c,q) for c,v in x.items() for q in v]
def get(item):
 c,q=item;target=root/'assets/images/categories'/c.lower()/(q['a'].lower()+'.webp');target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():
  raw=subprocess.run(['curl','-fsSL','-A','BattlePicz/1.0 (https://battle-picz-game.vercel.app/; picture catalogue)','--max-time','25',q.get('remoteImage',q['image'])],capture_output=True,check=True).stdout
  import io
  source=Image.open(io.BytesIO(raw)).convert('RGBA');im=Image.new('RGBA',source.size,'white');im.alpha_composite(source);im=im.convert('RGB');im.thumbnail((800,800));im.save(target,'WEBP',quality=88)
 q['remoteImage']=q.get('remoteImage',q['image']);q['image']=str(target.relative_to(root));q['modifications']='Resized and converted to WebP'
 return target
paths=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for item,result in zip(items,pool.map(get,items)):paths.append(result)
(root/'docs/starter-image-sources.json').write_text(json.dumps(x,indent=2))
for page,start in enumerate(range(0,len(items),30)):
 group=items[start:start+30];sheet=Image.new('RGB',(1000,155*((len(group)+4)//5)),'white');d=ImageDraw.Draw(sheet)
 for i,(cat,q) in enumerate(group):
  im=Image.open(root/q['image']);im.thumbnail((190,120));xx=(i%5)*200;yy=(i//5)*155;sheet.paste(im,(xx,yy));d.text((xx,yy+125),cat+': '+q['a'],fill='black')
 sheet.save('/tmp/category-review-'+str(page)+'.jpg')
print('Prepared',len(items),'pictures')
