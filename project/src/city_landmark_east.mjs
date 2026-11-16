/** Friedensengel feature, City feature engine v1.
 * Integration: import {createFeature} from './city_landmark_east.mjs';
 * const east = createFeature(engine); register east with the common feature host.
 * Load city_landmark_east.css once. Host owns updates, keys and geographic transform.
 */
export const FRIEDENSENGEL = Object.freeze({
  id: 'friedensengel', name: '和平天使 · Friedensengel',
  // Commons object coordinates, NOT the camera coordinates on the photo page.
  lon: 11.5969, lat: 48.1414, interactionRadius: 30,
  columnHeight: 23, figureHeight: 6,
  coordinateSource: 'https://commons.wikimedia.org/wiki/Category:Friedensengel_(M%C3%BCnchen)',
  architectureSource: 'https://www.schloesser.bayern.de/deutsch/garten/objekte/mu_max.htm',
  citySource: 'https://www.muenchen.de/sehenswuerdigkeiten/aussichtspunkte/friedensengel',
  photoPage: 'https://commons.wikimedia.org/wiki/File:Munich_-_Friedensengel.jpg',
  photoAuthor: 'Tiia Monto', photoLicense: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
});

/** Build around local origin, +Y up, metre scale; no map or renderer access. */
export function buildFriedensengel(THREE) {
  const group = new THREE.Group();
  group.name = 'city-landmark-east-friedensengel';
  group.userData = {landmark: FRIEDENSENGEL.id, approximateGeometry: true};
  const geometries = new Set(), materials = new Set();
  const own = geometry => {geometries.add(geometry); return geometry;};
  const material = options => {
    const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m;
  };
  const stone = material({color: 0xd2c5a6, roughness: .9});
  const pale = material({color: 0xe4ddc8, roughness: .8});
  const bronze = material({color: 0x514f3d, metalness: .55, roughness: .6});
  // A little roughness keeps the silhouette legible without an environment map.
  const gold = material({color: 0xf3bf43, metalness: .65, roughness: .34});
  const mosaic = material({color: 0x997a3e, metalness: .1, roughness: .85});
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const unitSphere = own(new THREE.SphereGeometry(1, 12, 8));
  const cylinderCache = new Map();
  const cylinder = (top, bottom, height, segments = 24) => {
    const key = [top,bottom,height,segments].join(',');
    if (!cylinderCache.has(key)) cylinderCache.set(key, own(new THREE.CylinderGeometry(top,bottom,height,segments)));
    return cylinderCache.get(key);
  };
  function mesh(name, geometry, mat, position, scale, parent = group) {
    const m = new THREE.Mesh(geometry, mat); m.name = name;
    m.position.set(...position); if (scale) m.scale.set(...scale);
    parent.add(m); return m;
  }
  const box = (name, size, pos, mat = stone, parent = group) => mesh(name,unitBox,mat,pos,size,parent);
  const sphere = (name, size, pos, mat = gold, parent = group) => mesh(name,unitSphere,mat,pos,size,parent);
  const cyl = (name,top,bottom,height,pos,mat=stone,parent=group,segments=24) => mesh(name,cylinder(top,bottom,height,segments),mat,pos,null,parent);
  function rod(name,a,b,r,mat,parent=group) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const m = cyl(name,r,r,delta.length(),start.clone().add(end).multiplyScalar(.5).toArray(),mat,parent,8);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return m;
  }

  // Approximate Korenhalle: stepped stylobate, open bays, small central shrine,
  // caryatid silhouettes and a flat entablature. Width/depth/detail are artistic.
  box('lowest-step',[11,.35,9],[0,.175,0]);
  box('middle-step',[10,.35,8],[0,.525,0]);
  box('hall-floor',[9.3,.4,7.3],[0,.9,0]);
  box('shrine-back',[1.4,4.9,3.6],[2.4,3.55,0]);
  box('mosaic-panel',[.04,3.4,2.7],[1.68,3.6,0],mosaic);
  for (const x of [-3.5,3.5]) for (const z of [-2.5,2.5]) {
    box('hall-pier-foot',[.95,.45,.95],[x,1.325,z]);
    box('hall-pier',[.7,4.8,.7],[x,3.95,z]);
    box('hall-pier-capital',[1,.35,1],[x,6.525,z]);
  }
  // Front faces west (-X), with two small stone figures below the column.
  for (const z of [-1.65,1.65]) {
    cyl('caryatid-robe',.18,.36,2.4,[-3.55,2.75,z],pale);
    sphere('caryatid-torso',[.27,.5,.23],[-3.55,4.2,z],pale);
    sphere('caryatid-head',[.23,.3,.23],[-3.55,4.9,z],pale);
    box('caryatid-abacus',[.65,.2,.65],[-3.55,5.3,z],pale);
  }
  box('entablature',[9,.55,7],[0,6.9,0]);
  box('cornice',[9.6,.4,7.6],[0,7.375,0],pale);
  box('column-pedestal',[3.7,.425,3.7],[0,7.7875,0]);

  // The full column assembly occupies y=8..31: sourced 23 m height.
  cyl('column-base-plinth',1.85,1.85,.65,[0,8.325,0]);
  cyl('column-base-torus',1.6,1.8,.4,[0,8.85,0],pale);
  cyl('column-shaft',1.04,1.28,19.3,[0,18.7,0],pale,group,48);
  // Fine raised ribs suggest fluting without texture downloads or CSG.
  for (let i=0;i<24;i++) {
    const a=i*Math.PI*2/24;
    rod('column-flute',[Math.cos(a)*1.28,9.1,Math.sin(a)*1.28],
      [Math.cos(a)*1.045,28.3,Math.sin(a)*1.045],.035,stone);
  }
  cyl('capital-bell',1.7,1.05,1.5,[0,29.1,0],bronze);
  for (let i=0;i<12;i++) {
    const a=i*Math.PI*2/12;
    const leaf=sphere('capital-acanthus',[.22,.65,.16],[Math.cos(a)*1.35,29.15,Math.sin(a)*1.35],bronze);
    leaf.rotation.y=-a;
  }
  box('capital-abacus',[3.6,.45,3.6],[0,30.175,0],bronze);
  cyl('capital-crown',1.5,1.4,.6,[0,30.7,0],bronze);
  cyl('statue-plinth',.7,1.1,1,[0,31.5,0],bronze);

  // Six-metre Nike silhouette (y=32..38), facing west along Prinzregentenstraße.
  // Original low-poly geometry; reference photo remains linked with full credit.
  const figure = new THREE.Group(); figure.name='gilded-winged-nike';
  figure.position.y=32; figure.rotation.y=-Math.PI/2; group.add(figure);
  cyl('draped-skirt',.36,.78,2.55,[0,1.325,0],gold,figure,16);
  for (let i=0;i<10;i++) {
    const a=i*Math.PI*2/10;
    rod('robe-fold',[Math.cos(a)*.68,.12,Math.sin(a)*.68],
      [Math.cos(a)*.33,2.5,Math.sin(a)*.33],.045,gold,figure);
  }
  sphere('nike-torso',[.48,.85,.32],[0,3.0,0],gold,figure);
  sphere('nike-neck',[.16,.24,.16],[0,3.85,0],gold,figure);
  sphere('nike-head',[.29,.37,.27],[0,4.27,.04],gold,figure);
  sphere('nike-hair',[.32,.28,.25],[0,4.4,-.1],gold,figure);
  rod('right-upper-arm',[-.37,3.5,0],[-.9,3.9,.15],.14,gold,figure);
  rod('right-raised-arm',[-.9,3.9,.15],[-1.14,4.65,.22],.11,gold,figure);
  rod('olive-branch',[-1.14,4.6,.22],[-1.3,5.65,.22],.025,gold,figure);
  for (let i=0;i<5;i++) for (const side of [-1,1]) {
    const leaf=sphere('olive-leaf',[.12,.055,.045],[-1.25+side*.1,4.95+i*.13,.22],gold,figure);
    leaf.rotation.z=side*.55;
  }
  rod('left-upper-arm',[.37,3.5,0],[.8,3.1,.23],.14,gold,figure);
  rod('left-forearm',[.8,3.1,.23],[1.1,3.5,.4],.1,gold,figure);
  // Small Palladion held in the left hand, not a second full-size figure.
  cyl('palladion-robe',.12,.2,.65,[1.1,3.85,.4],gold,figure,8);
  sphere('palladion-head',[.13,.16,.13],[1.1,4.3,.4],gold,figure);
  for (const side of [-1,1]) {
    const shape = new THREE.Shape();
    // Feathered wing outline in a local XY plane, thicker than a flat sprite.
    const points=[[.2,3.35],[.65,4.35],[2.15,6],[1.95,4.95],[1.4,4.1],[.65,3.25]];
    shape.moveTo(side*points[0][0],points[0][1]);
    for (const [x,y] of points.slice(1)) shape.lineTo(side*x,y);
    shape.closePath();
    mesh(`nike-wing-${side}`,own(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false})),gold,[0,0,-.35],null,figure);
    for (let i=0;i<7;i++) {
      const t=i/7;
      rod('wing-feather',[side*(.45+.45*t),3.55+.45*t,-.18],
        [side*(1.35+.65*t),4.1+1.55*t,-.18],.055,gold,figure);
    }
  }
  let disposed=false;
  return {group, dispose() {
    if (disposed) return; disposed=true;
    group.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
  }};
}

export function createFeature(engine) {
  const {document: doc, THREE} = engine;
  const model=buildFriedensengel(THREE);
  let detachGeo, panel, prompt, unregister;
  let disposed=false;
  const blocked=()=>Boolean(engine.isInputBlocked?.());
  function distance() {
    const p=engine.player;
    if (!Number.isFinite(p?.lon)||!Number.isFinite(p?.lat)) return Infinity;
    const d=engine.distance(p,FRIEDENSENGEL);
    return Number.isFinite(d)&&d>=0?d:Infinity;
  }
  const canInteract=()=>!disposed&&!panel?.isOpen()&&!blocked()&&distance()<=FRIEDENSENGEL.interactionRadius;
  function observe() {
    if (!canInteract()) return false;
    panel.open(); update(); return true;
  }
  function text(tag,value,parent=panel.body) {
    const el=doc.createElement(tag); el.textContent=value; parent.appendChild(el); return el;
  }
  function link(label,url,parent=panel.body) {
    const a=text('a',label,parent); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; return a;
  }
  function update() {
    if (disposed) return;
    const nearby=canInteract();
    prompt.hidden=!nearby||engine.getSettings?.().hints===false;
  }
  function dispose() {
    if (disposed) return; disposed=true;
    unregister?.();
    prompt?.removeEventListener('click',observe); prompt?.remove();
    panel?.dispose();
    detachGeo?.(); model.dispose();
  }
  try {
    detachGeo=engine.addGeoObject({group:model.group,lon:FRIEDENSENGEL.lon,lat:FRIEDENSENGEL.lat,
      minZoom:13,maxDistance:4000,replaceBuildings:true});
    panel=engine.createPanel('city-landmark-east',{title:FRIEDENSENGEL.name,modal:true});
    panel.body.classList.add('city-landmark-east-panel');
    text('p','在高岸平台向西望：辨认小纪念厅、细长的科林斯柱，以及柱顶展开双翼的金色胜利女神 Nike。');
    text('p','观察提示：先找柱头的叶饰，再看女神右手的橄榄枝与左手的小型雅典娜像（Palladion）。从公共平台观察，不把纪念碑中心当作步行入口。');
    text('p','比例说明：柱体总成采用机构资料中的 23 米，女神轮廓采用城市门户记载的 6 米。底座、开间、翼展与装饰比例为照片参考的近似艺术模型，非实测复原；未重建高岸地形与完整阶梯。');
    text('h3','资料与照片署名');
    link('巴伐利亚宫殿管理局：Maximiliansanlagen（柱高与纪念厅）',FRIEDENSENGEL.architectureSource);
    link('慕尼黑城市门户：Friedensengel（Nike、橄榄枝与 Palladion）',FRIEDENSENGEL.citySource);
    link('Commons：纪念碑位置（非摄影机位置）',FRIEDENSENGEL.coordinateSource);
    link('参考照片：Munich - Friedensengel.jpg',FRIEDENSENGEL.photoPage);
    text('p',`照片作者：${FRIEDENSENGEL.photoAuthor} · 2014-08-10。照片未嵌入、未修改；链接至原文件页。`);
    link(`照片许可：${FRIEDENSENGEL.photoLicense}`,FRIEDENSENGEL.licenseUrl);
    text('p','三维模型为程序化简化几何；以上照片是外观参考，不是贴图。坐标为近似地标锚点，不代表测量精度。');
    prompt=doc.createElement('button'); prompt.type='button';
    prompt.className='city-landmark-east-prompt'; prompt.hidden=true;
    prompt.textContent='E · 观察和平天使 / Friedensengel';
    prompt.addEventListener('click',observe); engine.ui.appendChild(prompt);
    unregister=engine.onDispose?.(dispose); update();
  } catch (error) {dispose(); throw error;}
  return {update,canInteract,observe,isOpen:()=>!disposed&&panel.isOpen(),
    handleKey(key,event) {
      if (key!=='e'||event?.repeat||!canInteract()) return false;
      return observe();
    },dispose};
}
