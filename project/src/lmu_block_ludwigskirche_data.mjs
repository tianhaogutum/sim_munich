// Survey data distilled from assets/osm/ludwigskirche.json; no THREE dependency.
import { toWorld, ringToWorld, pointInPolygon, polygonBounds } from './date_geo.mjs';
import { CORE_BOUNDS } from './date_route.mjs';
// Exact surveyed footprints take priority over the conflicting z >= 55 strip.
// Geographic extent is fixed; its game-space bounds follow a shared recalibration.
const extent = ringToWorld([[11.57935,48.146409015681805],[11.58439,48.150207376960225]]);
const bounds = polygonBounds(extent);
export const SECTOR = Object.freeze({ minX:bounds.cx-bounds.hw,maxX:bounds.cx+bounds.hw,
  minZ:bounds.cz-bounds.hd,maxZ:bounds.cz+bounds.hd });
export const SURVEY_BUILDINGS = [
  {
    "id": "st-ludwig",
    "name": "St. Ludwig",
    "osmType": "way",
    "osmId": 25440202,
    "ring": [
      [
        11.5808695,
        48.1491151
      ],
      [
        11.5808407,
        48.1490554
      ],
      [
        11.5808074,
        48.1489861
      ],
      [
        11.5807381,
        48.1488422
      ],
      [
        11.5807052,
        48.1487739
      ],
      [
        11.5806732,
        48.1487074
      ],
      [
        11.5806866,
        48.1487045
      ],
      [
        11.5807612,
        48.1486885
      ],
      [
        11.5807885,
        48.1486826
      ],
      [
        11.5808205,
        48.148749
      ],
      [
        11.581162,
        48.1486758
      ],
      [
        11.5811424,
        48.148635
      ],
      [
        11.5814128,
        48.148577
      ],
      [
        11.5814319,
        48.1486167
      ],
      [
        11.5816311,
        48.148574
      ],
      [
        11.5817671,
        48.1488565
      ],
      [
        11.5815677,
        48.1488992
      ],
      [
        11.581584,
        48.1489331
      ],
      [
        11.5813122,
        48.1489913
      ],
      [
        11.5812959,
        48.1489576
      ],
      [
        11.5812468,
        48.1489681
      ],
      [
        11.5810119,
        48.1490184
      ],
      [
        11.5809429,
        48.1490332
      ],
      [
        11.5809717,
        48.1490932
      ],
      [
        11.5809469,
        48.1490985
      ],
      [
        11.5808695,
        48.1491151
      ]
    ],
    "holes": [],
    "height": 29,
    "roofHeight": 9,
    "tags": {
      "addr:city": "München",
      "addr:country": "DE",
      "addr:housenumber": "20",
      "addr:postcode": "80539",
      "addr:street": "Ludwigstraße",
      "addr:suburb": "Maxvorstadt",
      "amenity": "place_of_worship",
      "architect": "Friedrich von Gärtner",
      "architect:wikidata": "Q66149",
      "building": "church",
      "building:architecture": "rundbogenstil",
      "building:material": "limestone",
      "check_date": "2025-07-02",
      "denomination": "catholic",
      "diocese": "Erzbistum München und Freising",
      "heritage": "4",
      "heritage:operator": "BLfD",
      "loc_name": "Ludwigskirche",
      "name": "St. Ludwig",
      "name:fr": "église Saint-Louis de Munich",
      "ref:BLfD": "D-1-62-000-4110",
      "religion": "christian",
      "wheelchair": "yes",
      "wheelchair:description": "Aufzug im Nordturm",
      "wikidata": "Q250951",
      "wikipedia": "de:St. Ludwig (München)"
    }
  },
  {
    "id": "staatsbibliothek",
    "name": "Bayerische Staatsbibliothek",
    "osmType": "relation",
    "osmId": 52412,
    "ring": [
      [
        11.5809346,
        48.1468507
      ],
      [
        11.580907,
        48.1468565
      ],
      [
        11.5808051,
        48.1466407
      ],
      [
        11.5805669,
        48.1466907
      ],
      [
        11.5805733,
        48.1467042
      ],
      [
        11.5803152,
        48.1467584
      ],
      [
        11.5800524,
        48.1468137
      ],
      [
        11.5800453,
        48.1467986
      ],
      [
        11.5798052,
        48.1468491
      ],
      [
        11.5801193,
        48.1475144
      ],
      [
        11.5804209,
        48.1481532
      ],
      [
        11.5806601,
        48.1481029
      ],
      [
        11.5806538,
        48.1480896
      ],
      [
        11.5809353,
        48.1480304
      ],
      [
        11.5811768,
        48.1479797
      ],
      [
        11.5811825,
        48.1479917
      ],
      [
        11.5814195,
        48.1479419
      ],
      [
        11.5810852,
        48.1472338
      ],
      [
        11.5810586,
        48.1471775
      ],
      [
        11.5811227,
        48.1471641
      ],
      [
        11.5811333,
        48.1471864
      ],
      [
        11.5818956,
        48.1470261
      ],
      [
        11.581722,
        48.1466584
      ],
      [
        11.5809574,
        48.1468191
      ],
      [
        11.5809689,
        48.1468435
      ],
      [
        11.5809346,
        48.1468507
      ]
    ],
    "holes": [
      [
        [
          11.58013,
          48.1469862
        ],
        [
          11.5803123,
          48.1473724
        ],
        [
          11.5805735,
          48.1473176
        ],
        [
          11.5808411,
          48.1472614
        ],
        [
          11.5806588,
          48.1468751
        ],
        [
          11.58013,
          48.1469862
        ]
      ],
      [
        [
          11.5810983,
          48.14781
        ],
        [
          11.5809143,
          48.14742
        ],
        [
          11.5803824,
          48.1475317
        ],
        [
          11.5805664,
          48.1479217
        ],
        [
          11.5808575,
          48.1478605
        ],
        [
          11.5810983,
          48.14781
        ]
      ]
    ],
    "height": 21,
    "roofHeight": 3.5,
    "tags": {
      "access": "yes",
      "addr:city": "München",
      "addr:country": "DE",
      "addr:housenumber": "16",
      "addr:postcode": "80539",
      "addr:street": "Ludwigstraße",
      "air_conditioning": "yes",
      "amenity": "library",
      "building": "civic",
      "building:levels": "3",
      "contact:fax": "+49 89 286 38-2200",
      "contact:phone": "+49 89 286 38-2322",
      "contact:website": "https://www.bsb-muenchen.de/",
      "height": "15",
      "internet_access": "wlan",
      "internet_access:fee": "no",
      "name": "Bayerische Staatsbibliothek",
      "name:de": "Bayerische Staatsbibliothek",
      "name:en": "Bavarian State Library",
      "opening_hours": "Mo-Su 08:00-00:00; Jan 01 off; Jan 06 off; Feb 13 off; Mar 29 - Apr 01 off; May 01 off; May 09 off; May 19-20 off; May 30 off; Aug 15 off; Oct 03 off; Nov 01 off; Dec 24-26 off; Dec 31 off",
      "operator": "Freistaat Bayern",
      "operator:type": "government",
      "ref:isil": "DE-12",
      "roof:shape": "gabled",
      "short_name": "BSB",
      "toilets": "yes",
      "toilets:wheelchair": "yes",
      "type": "multipolygon",
      "wheelchair": "yes",
      "wheelchair:description": "Personaleingang hinter dem Gebäude auf der rechten Seite verwenden, dort kann geklingelt werden",
      "wikidata": "Q256507",
      "wikipedia": "de:Bayerische Staatsbibliothek"
    }
  }
];
export function placeRing(ring) {
  return ringToWorld(ring);
}
export const BUILDINGS = SURVEY_BUILDINGS.map(b => ({ ...b,
  outer: placeRing(b.ring), inner: b.holes.map(placeRing),
}));
export function containsBuilding(building, x, z) {
  return pointInPolygon(x, z, building.outer) && !building.inner.some(h => pointInPolygon(x, z, h));
}
// A facade-aligned frame measured from the OSM church's first and sixth nodes.
const north = BUILDINGS[0].outer[0], south = BUILDINGS[0].outer[5];
const length = Math.hypot(north.x - south.x, north.z - south.z);
export const CHURCH_FRAME = Object.freeze({ x: (north.x + south.x) / 2,
  z: (north.z + south.z) / 2, ux: (north.x - south.x) / length,
  uz: (north.z - south.z) / length });
export function localPoint(frame, u, v) {
  return { x: frame.x + frame.ux * u - frame.uz * v,
    z: frame.z + frame.uz * u + frame.ux * v };
}
export function localRect(frame, u, v, width, depth) {
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) => localPoint(frame, u + a*width/2, v + b*depth/2));
}
// Photo-measured annexes/arcade piers: the supplementary Overpass request failed
// three times. Distinguish estimates from the two surveyed landmark footprints.
const overlapsCore = ring => {
  const b=polygonBounds(ring);
  return b.cx+b.hw>CORE_BOUNDS.minX && b.cx-b.hw<CORE_BOUNDS.maxX &&
    b.cz+b.hd>CORE_BOUNDS.minZ && b.cz-b.hd<CORE_BOUNDS.maxZ;
};
export const ANNEXES = [-1,1].map(sign => ({ id: sign < 0 ? 'gaertner-house' : 'parish-house',
  u: sign*52, v: 11.5, width: 21, depth: 23,
  outer: localRect(CHURCH_FRAME, sign*52, 11.5, 21, 23), inner: [] })).filter(a => !overlapsCore(a.outer));
export const ARCADE_PIERS = [-1,1].flatMap(sign => Array.from({length:6}, (_,i) => ({
  id: `arcade-${sign}-${i}`, outer: localRect(CHURCH_FRAME, sign*(23.8+i*3.54), 1.1, 0.85, 2.2), inner: []
})));
// Only the north wing of Ludwigstrasse 14 reaches this sector. Three archive
// Overpass attempts failed (502 + two timeouts): the wing is a photo/map estimate.
// Clip it at the geographic southern ownership edge, not at a fixed game origin.
// Photo/map-estimated geographic anchor, not a per-block game-space offset.
const archiveAnchor=toWorld(48.14671668,11.57979786);
export const ARCHIVE_FRAME = Object.freeze({ ...archiveAnchor,
  ux:CHURCH_FRAME.ux, uz:CHURCH_FRAME.uz });
function clipAt(ring, axis, boundary, sign) {
  const out=[];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    const ia=sign*(a[axis]-boundary)>=0, ib=sign*(b[axis]-boundary)>=0;
    if(ia)out.push(a);
    if(ia!==ib) {
      const t=(boundary-a[axis])/(b[axis]-a[axis]);
      out.push({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)});
    }
  }
  return out;
}
export const ARCHIVE_FRAGMENT = { id:'hauptstaatsarchiv-north-wing-estimate',
  source:'photo/map estimate after three failed archive Overpass attempts',
  outer:clipAt(localRect(ARCHIVE_FRAME,-13,36.5,26,73),'x',toWorld(48.1464109964,11.58035).x,1),inner:[] };
export const FOOTPRINTS = [...BUILDINGS, ...ANNEXES, ARCHIVE_FRAGMENT, ...ARCADE_PIERS];
export function isBuildingPoint(x, z) { return FOOTPRINTS.some(b => containsBuilding(b, x, z)); }
export const CHURCH_VIEW = localPoint(CHURCH_FRAME, 0, -15);
// Library's long west facade follows outer nodes 8 → 10.
const ls = BUILDINGS[1].outer[8], ln = BUILDINGS[1].outer[10];
const ll = Math.hypot(ln.x-ls.x, ln.z-ls.z);
export const LIBRARY_FRAME = Object.freeze({ x:(ls.x+ln.x)/2, z:(ls.z+ln.z)/2,
  ux:(ln.x-ls.x)/ll, uz:(ln.z-ls.z)/ll });
export const STAIR_FOOTPRINT = [
  localPoint(LIBRARY_FRAME,-24,-8.9),localPoint(LIBRARY_FRAME,24,-8.9),
  localPoint(LIBRARY_FRAME,24,-.3),localPoint(LIBRARY_FRAME,-24,-.3),
];
export function isSolidPoint(x,z) {
  return isBuildingPoint(x,z) || pointInPolygon(x,z,STAIR_FOOTPRINT);
}
export const LIBRARY_VIEW = localPoint(LIBRARY_FRAME, 0, -13);
export const LANDMARKS = [
  { id:'ludwigskirche', name:'圣路德维希教堂', ...CHURCH_VIEW,
    text:'加特纳设计的圆拱风格教堂，1844 年祝圣；双塔高约 71 米。\n资料：慕尼黑市官网、OSM（场景示意）。' },
  { id:'staatsbibliothek', name:'巴伐利亚州立图书馆', ...LIBRARY_VIEW,
    text:'长长的宫殿式立面与双向室外阶梯，通向三个圆拱入口。\n资料：巴伐利亚州立图书馆官网、OSM（场景示意）。' },
  { id:'four-scholars', name:'阶梯上的四位学者', ...localPoint(LIBRARY_FRAME, 14, -13),
    text:'修昔底德、荷马、亚里士多德与希波克拉底，象征历史、诗歌、哲学和医学。\n资料：州立图书馆官网及 Literaturportal Bayern。' },
];
export const SURVEY_BOUNDS = SURVEY_BUILDINGS.map(b => ({ id:b.id, ...polygonBounds(ringToWorld(b.ring)) }));

// Two surveyed rear-garden stair runs; exact endpoints and tagged counts.
export const GARDEN_STEPS = [{"id": 533428482, "count": 4, "ring": [[11.5819913, 48.1470364], [11.5820028, 48.1470359]]}, {"id": 533428487, "count": 12, "ring": [[11.5817836, 48.1470778], [11.5817883, 48.1470925]]}];

// Street-agent coordination only: computed intersection polygons, no road mesh.
export const STREET_OVERLAPS = FOOTPRINTS.map(b => ({id:b.id,
  outer:clipAt(clipAt(clipAt(b.outer,'z',55,1),'z',105,-1),'x',-150,-1),
  inner:b.inner.map(h=>clipAt(clipAt(clipAt(h,'z',55,1),'z',105,-1),'x',-150,-1)).filter(h=>h.length>=3),
})).filter(b=>b.outer.length>=3);
