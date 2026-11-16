"""Validate district sources and compile the catalog consumed by the city game.

Run with --check in CI to detect a stale generated module. No network required.
"""
import argparse
import json
import math
import pathlib
import re
import subprocess
import unicodedata
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'src/city_research_data.mjs'
TYPES = {'park', 'square', 'historic-building', 'culture', 'public-art', 'community-landmark'}


def distance(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b['lon']-a['lon'])/2)**2
    return 12742000 * math.asin(math.sqrt(max(0, min(1, h))))


def https(value):
    return isinstance(value, str) and urlparse(value).scheme == 'https' and bool(urlparse(value).netloc)


def text(value):
    return isinstance(value, str) and bool(value.strip())


def german_key(name):
    # Existing packs often put the German name after a Chinese translation.
    parts = [s for s in name.split('·') if re.search('[a-zA-ZäöüÄÖÜß]', s)]
    value = parts[-1] if parts else name
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if c.isalnum())


def compile_catalog():
    script = "import {CITY_PLACES,CITY_TRAILS,CITY_DISTRICTS,CITY_BOUNDS} from './src/city_data.mjs'; console.log(JSON.stringify({places:CITY_PLACES,trails:CITY_TRAILS,districts:CITY_DISTRICTS,bounds:CITY_BOUNDS}));"
    base = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT, text=True))
    place_ids = {p['id'] for p in base['places']}
    route_ids = {r['id'] for r in base['trails']}
    districts = {d['name'] for d in base['districts']}
    known = list(base['places'])
    packs, pack_ids = [], set()
    bounds = base['bounds']

    def require(condition, context):
        if not condition:
            raise ValueError(context)

    for path in sorted((ROOT / 'assets/city_research').glob('session*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        pid = data.get('id', '')
        require(re.fullmatch(r'session\d{2}', pid) and path.stem == pid and pid not in pack_ids, f'{path.name}: invalid/duplicate pack ID')
        require(data.get('version') == 1 and data.get('district') in districts, f'{pid}: invalid version/district')
        require(isinstance(data.get('places'), list) and data['places'], f'{pid}: places required')
        require(isinstance(data.get('routes'), list) and isinstance(data.get('buildings'), list), f'{pid}: routes/buildings required')
        pack_ids.add(pid)
        expanded = int(pid[7:]) >= 14
        local_ids = set()
        sources = {s.get('url') for s in data.get('sources', []) if isinstance(s, dict)}
        require(all(https(s) for s in sources), f'{pid}: invalid source URL')
        for p in data['places']:
            identifier = p.get('id', '')
            require(identifier.startswith(pid+'-') and identifier not in place_ids, f'{pid}: duplicate/invalid place ID {identifier}')
            require(all(text(p.get(k)) for k in ['name', 'description']) and https(p.get('source')), f'{identifier}: missing name/description/source')
            require(p.get('accuracy') == 'approximate outdoor navigation point', f'{identifier}: accuracy contract')
            require(all(type(p.get(k)) in (int, float) and math.isfinite(p[k]) for k in ['lon', 'lat']), f'{identifier}: nonfinite coordinates')
            require(bounds['minLon'] <= p['lon'] <= bounds['maxLon'] and bounds['minLat'] <= p['lat'] <= bounds['maxLat'], f'{identifier}: outside city bounds')
            if expanded:
                require(p.get('type') in TYPES, f'{identifier}: invalid place type')
                require(all(text(p.get(k)) for k in ['explorationHint', 'access', 'coordinateNote', 'verifiedAt']), f'{identifier}: incomplete exploration metadata')
                require(https(p.get('coordinateSource')) and p['coordinateSource'] in sources and p['source'] in sources, f'{identifier}: source not inventoried')
                require(type(p.get('arrivalRadius')) in (int, float) and 15 <= p['arrivalRadius'] <= 50, f'{identifier}: arrival radius must be 15–50 metres')
                for other in known:
                    separation = distance(p, other)
                    require(separation > 1, f'{identifier}: same arrival point as {other["id"]}')
                    require(not (german_key(p['name']) == german_key(other['name']) and separation < 500), f'{identifier}: duplicate landmark {other["id"]}')
            place_ids.add(identifier)
            local_ids.add(identifier)
            known.append(p)
        by_id = {p['id']: p for p in data['places']}
        covered = set()
        for route in data['routes']:
            rid = route.get('id', '')
            stops = route.get('stops')
            require(text(rid) and rid not in route_ids and text(route.get('name')), f'{pid}: duplicate/invalid route ID {rid}')
            require(isinstance(stops, list) and stops and all(s in local_ids for s in stops), f'{rid}: route references missing place')
            require(len(stops) == len(set(stops)), f'{rid}: repeated stop')
            lengths = [distance(by_id[a], by_id[b]) for a, b in zip(stops, stops[1:])]
            total = round(sum(lengths))
            if expanded:
                require(4 <= len(stops) <= 7 and text(route.get('description')), f'{rid}: route requires 4–7 stops and description')
                require(max(lengths, default=0) <= 3500 and total <= 10000, f'{rid}: unusually long route segment/total')
                require(route.get('distanceKind') == 'straight-line segments', f'{rid}: distance must be labeled straight-line segments')
                require(type(route.get('distanceMeters')) in (int, float) and abs(route['distanceMeters']-total) <= 2, f'{rid}: incorrect computed distance (expected {total})')
            covered.update(stops)
            route_ids.add(rid)
        if expanded:
            require(local_ids <= covered, f'{pid}: new places absent from routes: {sorted(local_ids-covered)}')
        packs.append(data)

    payload = json.dumps(packs, ensure_ascii=False, separators=(',', ':'))
    content = """// Generated from district sources; run python3 tools/build_city_research.py. Do not hand-edit.
import { CITY_PLACES, CITY_TRAILS } from './city_data.mjs';
const freeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);} return value; };
export const RESEARCH_PACKS = freeze(""" + payload + """);
// An already registered pack must not produce a second marker or route.
const mergeCatalog = (base, additions) => Object.freeze([...new Map([...base, ...additions].map(item=>[item.id,item])).values()]);
export const ALL_CITY_PLACES = mergeCatalog(CITY_PLACES, RESEARCH_PACKS.flatMap(pack=>pack.places.map(p=>freeze({...p,district:pack.district,researchPack:pack.id,mapSource:`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`,coordinateStatus:p.accuracy}))));
export const ALL_CITY_TRAILS = mergeCatalog(CITY_TRAILS, RESEARCH_PACKS.flatMap(pack=>pack.routes.map(r=>freeze({...r,places:r.stops,district:pack.district,researchPack:pack.id}))));
export const RESEARCH_BUILDINGS = Object.freeze(RESEARCH_PACKS.flatMap(pack=>pack.buildings));
"""
    return packs, content


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail when generated catalog is stale; do not write')
    args = parser.parse_args()
    packs, content = compile_catalog()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != content:
            raise SystemExit('City catalog is stale. Run python3 project/tools/build_city_research.py')
    else:
        OUTPUT.write_text(content, encoding='utf-8')
    print(f'Validated {len(packs)} districts/packs, {sum(len(p["places"]) for p in packs)} research places, {sum(len(p["routes"]) for p in packs)} playable routes.')
