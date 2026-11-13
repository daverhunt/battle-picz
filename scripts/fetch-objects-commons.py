#!/usr/bin/env python3
"""Retrieve Wikimedia Commons photographs for approved Pic Rivals Objects.
Run from repository root. Requires Pillow and requests.
Does not modify Supabase: generated photos must be reviewed before activation.
"""
import argparse
import html
import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
import requests
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs/objects-next-81.json"
SOURCE_FILE = ROOT / "docs/objects-next-81-sources.json"
OVERRIDE_FILE = ROOT / "docs/objects-photo-overrides.json"
API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "PicRivalsCategoryArtwork/1.0 (educational picture quiz; https://github.com/daverhunt/battle-picz)", "Accept": "application/json,image/*"}
BANNED = ("logo", "diagram", "drawing", "sketch", "illustration", "cartoon", "clipart", "collage", "advertis", "poster", "icon", "flag", "map", "painting", "sheet music", "historical", "vintage postcard", "museum sign", "illustrated")
LICENSES = ("CC0", "CC BY", "CC-BY", "PUBLIC DOMAIN", "PDM")
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

def request(url, params=None, binary=False):
    for attempt in range(5):
        try:
            resp = SESSION.get(url, params=params, timeout=35)
            if resp.status_code in (429, 500, 502, 503, 504):
                time.sleep(min(3 * (attempt + 1), 15)); continue
            resp.raise_for_status()
            return resp.content if binary else resp.json()
        except (requests.RequestException, ValueError) as err:
            if attempt == 4: raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("Request retry limit reached")

def strip_html(value):
    return html.unescape(re.sub("<[^>]+>", "", value or "")).strip()

def field(info, key):
    val = info.get("extmetadata", {}).get(key, {})
    return strip_html(val.get("value", "") if isinstance(val, dict) else val)

def commons_search(answer, limit=24):
    # Search title relevance first. Do not silently substitute an unrelated photo.
    terms = [f'filetype:bitmap intitle:"{answer}"', f'filetype:bitmap "{answer}"']
    results = []
    for term in terms:
        data = request(API, {
            "action":"query", "format":"json", "generator":"search",
            "gsrsearch":term, "gsrnamespace":6, "gsrlimit":limit,
            "prop":"imageinfo", "iiprop":"url|size|mime|extmetadata",
            "iiurlwidth":640,
            "iiextmetadatafilter":"LicenseShortName|LicenseUrl|Artist|Attribution|UsageTerms|Credit",
        })
        results.extend(data.get("query",{}).get("pages",{}).values())
        if len(results) > 8: break
        time.sleep(.18)
    return results

def curated_photo(filename):
    """Retrieve Wikimedia Commons metadata for a hand-selected subject photograph."""
    data=request(API,{
        "action":"query","format":"json","titles":"File:"+filename,
        "prop":"imageinfo","iiprop":"url|size|mime|extmetadata",
        "iiurlwidth":640,
        "iiextmetadatafilter":"LicenseShortName|LicenseUrl|Artist|Attribution|Credit"
    })
    result=list(data.get("query",{}).get("pages",{}).values())
    for page in result: page["_curated"]=True
    return result

def wikidata_photos(answer):
    """Use a Wikidata concept's P18 photo before ambiguous filename matches."""
    precise_terms={"mouse":"computer mouse","tablet":"tablet computer",
      "iron":"clothes iron","peg":"clothes peg","stamp":"postage stamp",
      "sponge":"cleaning sponge","razor":"safety razor","balloon":"toy balloon",
      "jigsaw":"jigsaw puzzle","compass":"magnetic compass",
      "rubber band":"rubber band","torch":"flashlight"}
    concept=precise_terms.get(answer.lower(),answer)
    search=request("https://www.wikidata.org/w/api.php",{
        "action":"wbsearchentities","format":"json","language":"en",
        "type":"item","search":concept,"limit":12,
    })
    ids=[]
    for item in search.get("search",[]):
        if item.get("label","").strip().lower()!=concept.lower(): continue
        description=item.get("description","").lower()
        if any(term in description for term in (
            "film","album","song","surname","person","politician","writer",
            "village","town","city","river","road","street","mountain","species",
            "company","fictional","award","book by","video game","character",
            "painting","artwork","building","theater","stadium",
        )): continue
        ids.append(item["id"])
    if not ids: return []
    entities=request("https://www.wikidata.org/w/api.php",{
        "action":"wbgetentities","format":"json","ids":"|".join(ids[:7]),
        "props":"claims",
    }).get("entities",{})
    results=[]
    for qid in ids:
        entity=entities.get(qid,{})
        for claim in entity.get("claims",{}).get("P18",[])[:2]:
            try: filename=claim["mainsnak"]["datavalue"]["value"]
            except (KeyError,TypeError): continue
            data=request(API,{
                "action":"query","format":"json","titles":"File:"+filename,
                "prop":"imageinfo","iiprop":"url|size|mime|extmetadata",
                "iiurlwidth":640,
                "iiextmetadatafilter":"LicenseShortName|LicenseUrl|Artist|Attribution|Credit"
            })
            for page in data.get("query",{}).get("pages",{}).values():
                page["_wikidata"]=qid
                results.append(page)
        if results: break
    return results

def score(page, answer):
    name = page.get("title","").replace("File:","").lower()
    name = re.sub(r"[_-]+", " ", name)
    core = re.escape(answer.lower())
    trusted_depiction=bool(page.get("_wikidata") or page.get("_curated"))
    if not trusted_depiction and not re.search(rf"(?<![a-z]){core}(?![a-z])", name): return -1000
    if any(bad in name for bad in BANNED): return -1000
    # Reject other meanings and places that match the word but not the item.
    off_topic=("lane","road","street","river","town","park","village","bridge","railway",
      "basalt","geology","kidney","cake","film","festival","tour","transport",
      "building","station","garden","flower","phlox","animal","species","bird",
      "mountain","rock","coast","ship","aircraft","car","train","trophy",
      "surname","person","school","church","landscape","ruler kolchak",
      "company","fighter","cricket","museum exterior","coffee shop","coffee roastery",
      "cliff","plunger ssn","rug chapel","stool transport","cushion plant")
    if not trusted_depiction and any(word in name for word in off_topic): return -1000
    ii = (page.get("imageinfo") or [{}])[0]
    if ii.get("mime") not in ("image/jpeg","image/png","image/webp"): return -1000
    if min(ii.get("width",0),ii.get("height",0)) < 320: return -1000
    lic = field(ii,"LicenseShortName").upper()
    if not any(marker in lic for marker in LICENSES): return -1000
    if "NC" in lic or "ND" in lic: return -1000
    relevant = len(re.findall(r"[a-z]+", name))
    result = 1300 if page.get("_curated") else (1000 if trusted_depiction else 120 - min(relevant,25)*2)
    if name.startswith(answer.lower()+" ") or name.startswith(answer.lower()+"."): result += 40
    if "white background" in name or "isolated" in name: result += 22
    if "photo" in name: result += 9
    if re.search(r"(?:\bperson\b|\bpeople\b|\bman\b|\bwoman\b)", name): result -= 20
    return result

def render_image(blob):
    im = Image.open(io.BytesIO(blob))
    if im.format not in ("JPEG","PNG","WEBP"): raise ValueError("Unsupported image format")
    im.load()
    if min(im.size) < 320: raise ValueError("Image too small")
    if im.width/im.height > 3.5 or im.height/im.width > 3.5:
        raise ValueError("Panorama is not appropriate for a puzzle")
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((640,640), Image.Resampling.LANCZOS)
    # Keep full subject instead of cropping significant parts of the picture.
    canvas = Image.new("RGB",(640,640),(250,248,242))
    canvas.paste(im, ((640-im.width)//2,(640-im.height)//2))
    output = io.BytesIO()
    canvas.save(output,format="WEBP",quality=83,method=6)
    return output.getvalue()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--limit",type=int,default=0,help="For testing, maximum additional items to fetch")
    parser.add_argument("--strict",action="store_true",help="Fail if any object is missing")
    args=parser.parse_args()
    items=json.loads(CATALOG.read_text())["items"]
    existing=json.loads(SOURCE_FILE.read_text()) if SOURCE_FILE.exists() else {}
    records=existing.get("items",{})
    overrides=json.loads(OVERRIDE_FILE.read_text()).get("files",{}) if OVERRIDE_FILE.exists() else {}
    failures={}
    completed=0
    for item in items:
        slug=item["slug"]
        path=ROOT/item["image"]
        quality=records.get(slug,{}).get("quality")
        if path.exists() and quality in ("wikidata-depicts","curated-photo") and not (slug in overrides and quality!="curated-photo"):
            print(f"KEEP verified {slug}",flush=True)
            continue
        if args.limit and completed >= args.limit: break
        completed+=1
        print(f"FETCH {slug}",flush=True)
        try:
            candidates=curated_photo(overrides[slug]) if slug in overrides else wikidata_photos(item["answer"])
            if not any(score(p,item["answer"])>=30 for p in candidates):
                candidates+=commons_search(item["answer"])
            candidates=sorted(candidates,key=lambda p:score(p,item["answer"]),reverse=True)
            found=False
            for page in candidates[:12]:
                if score(page,item["answer"])<30: break
                info=(page.get("imageinfo") or [{}])[0]
                url=info.get("thumburl") or info.get("url")
                if not url or urlparse(url).scheme != "https": continue
                try:
                    picture=render_image(request(url,binary=True))
                except (requests.RequestException,ValueError,UnidentifiedImageError,OSError) as err:
                    print(f"  skipped {page.get('title')}: {str(err)[:90]}",flush=True)
                    continue
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_bytes(picture)
                records[slug]={
                    "answer":item["answer"],"image":item["image"],
                    "source":info.get("descriptionurl",""),
                    "artist":field(info,"Artist") or field(info,"Attribution") or field(info,"Credit"),
                    "license":field(info,"LicenseShortName"),
                    "licenseUrl":field(info,"LicenseUrl"),
                    "original":info.get("url",""),
                    "modifications":"Resized and converted to WebP; letterboxed on cream background",
                    "reviewed":False,
                    "quality":"curated-photo" if page.get("_curated") else ("wikidata-depicts" if page.get("_wikidata") else "title-match"),
                    "wikidata":page.get("_wikidata"),
                }
                print(f"  saved {page.get('title')} ({len(picture)} bytes)",flush=True)
                found=True
                break
            if not found: failures[slug]="No suitable openly licensed picture found"
        except Exception as err:
            failures[slug]=str(err)[:200]
            print(f"  failed: {err}",flush=True)
        SOURCE_FILE.write_text(json.dumps({"category":"OBJECTS","items":records,"failures":failures},indent=2,ensure_ascii=False)+"\n")
        time.sleep(.28)
    print(f"Newly attempted: {completed}; total photos present: {len(records)}; failures: {len(failures)}",flush=True)
    if failures: print(json.dumps(failures,indent=2),flush=True)
    if args.strict and (failures or len(records)!=len(items)): sys.exit(1)

if __name__=="__main__":
    main()
