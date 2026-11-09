// City-scale navigation data. Bounds are a gameplay rectangle, not a municipal boundary.
// District names: Landeshauptstadt München, checked 2026-11-09.
export const CITY_BOUNDS = Object.freeze({minLon:11.35,maxLon:11.8,minLat:48.05,maxLat:48.27});
export const CITY_ORIGIN = Object.freeze({lon:11.58035,lat:48.15075});
export const CITY_DISTRICT_SOURCE='https://stadt.muenchen.de/rathaus/daten-fakten/bezirke.html';
const M_LAT=111320, M_LON=M_LAT*Math.cos(CITY_ORIGIN.lat*Math.PI/180);
export function cityToLocal(lon,lat){return {x:(lon-CITY_ORIGIN.lon)*M_LON,z:(CITY_ORIGIN.lat-lat)*M_LAT};}
export function localToCity(x,z){return {lon:CITY_ORIGIN.lon+x/M_LON,lat:CITY_ORIGIN.lat-z/M_LAT};}
const districts=[
[1,'Altstadt-Lehel',11.579,48.138],[2,'Ludwigsvorstadt-Isarvorstadt',11.565,48.129],
[3,'Maxvorstadt',11.568,48.153],[4,'Schwabing-West',11.568,48.169],
[5,'Au-Haidhausen',11.600,48.128],[6,'Sendling',11.548,48.119],
[7,'Sendling-Westpark',11.521,48.118],[8,'Schwanthalerhöhe',11.539,48.135],
[9,'Neuhausen-Nymphenburg',11.515,48.158],[10,'Moosach',11.505,48.184],
[11,'Milbertshofen-Am Hart',11.575,48.192],[12,'Schwabing-Freimann',11.610,48.188],
[13,'Bogenhausen',11.638,48.158],[14,'Berg am Laim',11.632,48.123],
[15,'Trudering-Riem',11.692,48.121],[16,'Ramersdorf-Perlach',11.634,48.100],
[17,'Obergiesing-Fasangarten',11.590,48.109],[18,'Untergiesing-Harlaching',11.567,48.092],
[19,'Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln',11.513,48.083],
[20,'Hadern',11.481,48.111],[21,'Pasing-Obermenzing',11.455,48.154],
[22,'Aubing-Lochhausen-Langwied',11.415,48.173],[23,'Allach-Untermenzing',11.461,48.194],
[24,'Feldmoching-Hasenbergl',11.537,48.219],[25,'Laim',11.503,48.139],
];
export const CITY_DISTRICTS=Object.freeze(districts.map(([id,name,lon,lat])=>Object.freeze({id,name,lon,lat,source:CITY_DISTRICT_SOURCE,coordinateStatus:'approximate navigation anchor; not an administrative centroid'})));
const official='https://www.muenchen.de/en/sights/sightseeing-25-top-sights-and-attractions-munich';
// Coordinates are approximate outdoor navigation anchors, deliberately not entry/door positions.
// Source links identify the landmark; tile geometry supplies the actual surrounding street fabric.
const places=[
['lmu','LMU 主楼',11.5807,48.1507,3,'从大学广场开始，沿路德维希大街走进城市。','https://www.lmu.de/en/about-lmu/lmu-at-a-glance/history/1840/'],
['siegestor','凯旋门 · Siegestor',11.5823,48.1528,3,'大学街区北端的纪念门；请从周围步道观察。'],
['odeonsplatz','Odeonsplatz',11.5779,48.1425,1,'王宫、统帅堂与铁阿提纳教堂围绕的城市广场。','https://www.muenchen.de/sehenswuerdigkeiten/sehenswerte-plaetze/odeonsplatz'],
['marienplatz','玛利亚广场 · Marienplatz',11.5755,48.1372,1,'旧城的中心，适合开始一段城市步行。'],
['viktualienmarkt','Viktualienmarkt',11.5761,48.1352,1,'在旧城市场周围的街巷寻找生活气息。'],
['frauenkirche','圣母教堂 · Frauenkirche',11.5731,48.1384,1,'双塔教堂周围的步行街区。'],
['residenz','慕尼黑王宫 · Residenz',11.5792,48.1413,1,'王宫外部与周边街道的城市视角。','https://www.residenz-muenchen.de/'],
['hofgarten','宫廷花园 · Hofgarten',11.5805,48.1435,1,'穿过花园外围步道，回望王宫与城市。'],
['karlsplatz','卡尔广场 · Stachus',11.5660,48.1392,1,'旧城西端的交通节点与步行街入口。'],
['sendlinger-tor','森德灵门 · Sendlinger Tor',11.5671,48.1337,1,'旧城南缘的城门与街巷。'],
['isar','伊萨尔河 · Reichenbachbrücke',11.5769,48.1279,2,'沿河岸步道探索南侧的城市风景。'],
['deutsches-museum','德意志博物馆周边',11.5830,48.1297,2,'博物馆岛与伊萨尔河桥梁。','https://www.deutsches-museum.de/'],
['koenigsplatz','国王广场 · Königsplatz',11.5654,48.1459,3,'博物馆区里开阔的广场与古典建筑。'],
['alte-pinakothek','老绘画陈列馆',11.5700,48.1482,3,'艺术区的步行节点，观赏建筑外部与周边绿地。','https://www.pinakothek.de/'],
['eisbach','冰溪 · Eisbach',11.5879,48.1435,1,'英国花园南端的水道；这是岸边观察点。'],
['chinesischer-turm','中国塔 · Chinesischer Turm',11.5923,48.1527,12,'英国花园中的地标与林荫步道。'],
['muenchner-freiheit','Münchner Freiheit',11.5863,48.1610,12,'施瓦宾街区的广场与城市生活。'],
['olympiapark','奥林匹克公园',11.5517,48.1742,11,'湖泊、丘陵和体育建筑组成的城市公园。','https://www.olympiapark.de/'],
['bmw-welt','BMW Welt',11.5565,48.1767,11,'奥林匹克公园东侧的建筑与广场。','https://www.bmw-welt.com/'],
['nymphenburg','宁芬堡宫',11.5053,48.1585,9,'从宫前广场望向水道与宫殿。','https://www.schloss-nymphenburg.de/'],
['hirschgarten','Hirschgarten',11.5172,48.1498,9,'西部公园里的慢行探索。'],
['westpark','西公园 · Westpark',11.5213,48.1229,7,'城市西南部的公园步道与水面。'],
['theresienwiese','Theresienwiese',11.5501,48.1310,2,'开阔的城市活动场地与周边街区。'],
['bavaria','Bavaria 纪念像',11.5458,48.1306,8,'在纪念像前的广场停留，远望城市。'],
['gasteig','Gasteig 周边',11.5920,48.1313,5,'海德豪森与伊萨尔河东岸的文化街区。'],
['ostbahnhof','慕尼黑东站周边',11.6048,48.1276,5,'从车站外广场探索海德豪森街道。'],
['harlaching','Harlaching · Menterschwaige',11.5528,48.0863,18,'沿南部河谷边缘的街区探索。'],
['pasing','Pasing Marienplatz',11.4610,48.1460,21,'西部帕辛的街区中心。'],
['moosach','Moosacher St.-Martins-Platz',11.5050,48.1811,10,'西北部街区的公共广场。'],
['feldmoching','Feldmoching',11.5412,48.2149,24,'向北探索城市边缘的住宅与旧村落街道。'],
['allianz-arena','安联球场周边',11.6247,48.2189,12,'北部体育建筑外部与周边通道。','https://allianz-arena.com/'],
['messestadt','Messestadt Riem',11.6918,48.1328,15,'东部会展新城的广场与宽阔街道。'],
['riemer-park','Riemer Park',11.7017,48.1245,15,'城市东部的大型景观公园。'],
['neuperlach','Neuperlach · PEP',11.6453,48.1000,16,'东南部住宅街区与公共交通节点。'],
['hadern','Großhadern',11.4765,48.1148,20,'西南部街区的步行探索锚点。'],
['allach','Allach',11.4684,48.1893,23,'西北侧旧村落与住宅街道。'],
['aubing','Aubing',11.4130,48.1580,22,'向西走进奥宾的街区道路。'],
];
export let CITY_PLACES=Object.freeze(places.map(([id,name,lon,lat,district,description,source])=>Object.freeze({id,name,lon,lat,district,description,source:source??official,mapSource:`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`,coordinateStatus:'approximate outdoor navigation anchor'})));
// A spatial work manifest, not district borders and not a claim that 100 agents ran.
export const CITY_SECTORS=Object.freeze(Array.from({length:100},(_,i)=>{
 const row=Math.floor(i/10),col=i%10,dx=(CITY_BOUNDS.maxLon-CITY_BOUNDS.minLon)/10,dy=(CITY_BOUNDS.maxLat-CITY_BOUNDS.minLat)/10;
 return Object.freeze({id:`munich-${String(i+1).padStart(3,'0')}`,row,col,minLon:CITY_BOUNDS.minLon+col*dx,maxLon:CITY_BOUNDS.minLon+(col+1)*dx,minLat:CITY_BOUNDS.minLat+row*dy,maxLat:CITY_BOUNDS.minLat+(row+1)*dy,status:'streamed-base-map; detailed-reference-refinement-pending'});
}));
export let CITY_TRAILS=Object.freeze([
 {id:'university-old-town',name:'大学到旧城',description:'从 LMU 沿城市主轴走到市场。',places:['lmu','odeonsplatz','marienplatz','viktualienmarkt']},
 {id:'art-garden',name:'艺术与花园',description:'博物馆区、宫廷花园与英国花园。',places:['koenigsplatz','alte-pinakothek','hofgarten','chinesischer-turm']},
 {id:'west-and-olympic',name:'宫殿与奥林匹克',description:'跨越城市西部与北部的探索路线。',places:['nymphenburg','hirschgarten','olympiapark','bmw-welt']},
 {id:'isar-east',name:'伊萨尔河到东城',description:'河岸、博物馆岛、海德豪森与里姆。',places:['isar','deutsches-museum','gasteig','ostbahnhof','messestadt','riemer-park']},
]);

// Register a pack atomically: malformed or duplicate packs cannot corrupt saves.
export let CITY_RESEARCH=Object.freeze([]);
export function registerCityResearch(pack){
 const fail=()=>{throw new TypeError('Invalid city research pack');};
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const point=p=>p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=CITY_BOUNDS.minLon&&p.lon<=CITY_BOUNDS.maxLon&&p.lat>=CITY_BOUNDS.minLat&&p.lat<=CITY_BOUNDS.maxLat;
 const https=v=>{try{return new URL(v).protocol==='https:';}catch{return false;}};
 if(!pack||pack.version!==1||!text(pack.id)||!text(pack.district)||!Array.isArray(pack.places)||!pack.places.length||!Array.isArray(pack.routes)||!Array.isArray(pack.buildings))fail();
 if(CITY_RESEARCH.some(p=>p.id===pack.id))return false;
 const district=CITY_DISTRICTS.find(d=>d.name===pack.district);if(!district)fail();
 const ids=new Set(CITY_PLACES.map(p=>p.id)),routeIds=new Set(CITY_TRAILS.map(t=>t.id));
 const additions=pack.places.map(p=>{
  if(!point(p)||!text(p.id)||!p.id.startsWith(`${pack.id}-`)||ids.has(p.id)||!text(p.name)||!text(p.description)||!https(p.source)||p.accuracy!=='approximate outdoor navigation point')fail();
  ids.add(p.id);return Object.freeze({...p,district:district.id,researchPack:pack.id,coordinateStatus:p.accuracy,mapSource:`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`});
 });
 const routes=pack.routes.map(r=>{
  if(!text(r.id)||routeIds.has(r.id)||!text(r.name)||!Array.isArray(r.stops)||!r.stops.length||r.stops.some(id=>!ids.has(id)))fail();
  routeIds.add(r.id);return Object.freeze({id:r.id,name:r.name,description:r.description??'',places:Object.freeze([...r.stops]),researchPack:pack.id});
 });
 for(const b of pack.buildings)if(!point(b)||!text(b.name)||!https(b.photoPage)||!https(b.source)||!text(b.author)||!text(b.license)||!Array.isArray(b.features)||!b.features.every(text))fail();
 const copy=JSON.parse(JSON.stringify(pack));
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 CITY_PLACES=Object.freeze([...CITY_PLACES,...additions]);
 CITY_TRAILS=Object.freeze([...CITY_TRAILS,...routes]);
 CITY_RESEARCH=Object.freeze([...CITY_RESEARCH,freeze(copy)]);
 return true;
}
