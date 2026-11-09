"""Compile isolated district packs into source-backed, playable city routes."""
import json, pathlib, re
root = pathlib.Path(__file__).resolve().parents[1]
packs=[]
for path in sorted((root/'assets/city_research').glob('session*.json')):
    data=json.loads(path.read_text())
    if not re.fullmatch(r'session\d{2}',data.get('id','')): raise ValueError(path)
    ids=set()
    for p in data.get('places',[]):
        if not (p.get('id','').startswith(data['id']+'-') and isinstance(p.get('lon'),(int,float)) and isinstance(p.get('lat'),(int,float)) and 11.35<=p['lon']<=11.8 and 48.05<=p['lat']<=48.27): raise ValueError((path,p))
        if p['id'] in ids: raise ValueError('Duplicate place')
        if not p.get('source','').startswith('https://'): raise ValueError('Source required')
        ids.add(p['id'])
    for r in data.get('routes',[]):
        if not r.get('stops') or not set(r['stops'])<=ids: raise ValueError((path,'route references absent place'))
    packs.append(data)
text="""// Generated from isolated district research; rebuild with tools/build_city_research.py.
import { CITY_PLACES, CITY_TRAILS, registerCityResearch } from './city_data.mjs';
export const RESEARCH_PACKS = """+json.dumps(packs,ensure_ascii=False,separators=(',',':'))+""";
export const ALL_CITY_PLACES = Object.freeze([...CITY_PLACES, ...RESEARCH_PACKS.flatMap(pack=>pack.places.map(p=>Object.freeze({...p,district:pack.district,mapSource:`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`,coordinateStatus:p.accuracy})))]);
export const ALL_CITY_TRAILS = Object.freeze([...CITY_TRAILS, ...RESEARCH_PACKS.flatMap(pack=>pack.routes.map(r=>({...r,places:r.stops,district:pack.district})))]);
export const RESEARCH_BUILDINGS = Object.freeze(RESEARCH_PACKS.flatMap(pack=>pack.buildings??[]));
"""
(root/'src/city_research_data.mjs').write_text(text)
print(f'Compiled {len(packs)} districts, {sum(len(p["places"]) for p in packs)} places, {sum(len(p["routes"]) for p in packs)} playable routes.')
