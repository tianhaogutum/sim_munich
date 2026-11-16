// Procedural exterior study; all mesh dimensions/orientation are approximate.
// No image textures, external requests, geographic transforms or tile filters.
export const OLDTOWN_LANDMARK = Object.freeze({
  id: 'frauenkirche', name: '圣母教堂 · Frauenkirche',
  // Commons building location: 48°08′18.88″N, 11°34′25.02″E.
  lon: 11 + 34 / 60 + 25.02 / 3600, lat: 48 + 8 / 60 + 18.88 / 3600,
  orientation: 0.12, accuracy: 'Approximate exterior study, not a surveyed reconstruction.',
});
export const OLDTOWN_SOURCES = Object.freeze([
  {title: 'Münchner Dom — Die Türme', url: 'https://www.muenchner-dom.de/die-kathedrale/rundgang/die-tuerme.html', credit: 'Metropolitanpfarrei München: twin towers and Renaissance domes (1525).'},
  {title: 'München — Frauenkirche', url: 'https://www.muenchen.de/sehenswuerdigkeiten/top-sehenswuerdigkeiten/frauenkirche', credit: 'City portal: north/south towers 98.57 / 98.45 m; 109 × 40 m church, 37 m interior. Interior height is not roof height.'},
  {title: 'Commons — Exterior of Frauenkirche', url: 'https://commons.wikimedia.org/wiki/Category:Exterior_of_Frauenkirche,_Munich', credit: 'Building coordinates and exterior reference catalog.'},
  {title: 'Commons — South tower and roof', url: 'https://commons.wikimedia.org/wiki/File:München_Frauenkirche,_Details_Südturm_und_Dach.jpg', credit: 'Adam Jones, crop by Ulamm, CC BY-SA 3.0. Visual reference only; no photograph embedded.'},
  {title: 'Commons — Aerial photograph', url: 'https://commons.wikimedia.org/wiki/File:München_-_Frauenkirche_(Luftbild).jpg', credit: 'Maximilian Dörrbecker (Chumwa), CC BY-SA 2.5. Massing reference only; no photograph embedded.'},
].map(Object.freeze));

const COLORS = {brick: 0xa87760, brickLight: 0xb78c73, stone: 0xcac1a7, roof: 0x684d42, copper: 0x6b9380, glass: 0x35434a, gold: 0xc5a052, door: 0x4c352a};

// Levels are additive: silhouette, windows, then close-up ornament.
export function planOldtownLandmark() {
  const parts = [];
  function put(name, shape, color, level, position, size, rotation = [0, 0, 0]) {
    parts.push({name, shape, color, level, position, size, rotation});
  }
  const box = (name, color, level, x, y, z, w, h, d, rotation) => put(name, 'box', color, level, [x,y,z], [w,h,d], rotation);
  box('nave', 'brick', 0, -7, 18.5, 0, 95, 37, 40);
  put('nave-roof', 'roof', 'roof', 0, [-7,48.5,0], [95,23,41.2]);
  put('choir', 'apse', 'brick', 0, [40.5,18.5,0], [14,37,40]);
  put('choir-roof', 'apseRoof', 'roof', 0, [40.5,48.5,0], [14.6,23,41.2]);
  box('foundation', 'stone', 1, -7,.5,0,95,1,40.3);
  for (const side of [-1,1]) {
    const z = side * 20.08;
    for (let i=0;i<9;i++) {
      const x = -29 + i*7.8;
      // Pointed Gothic lancets, with a stone border and two fine mullions.
      put('nave-window-frame', 'arch', 'stone', 1, [x,8,z], [4.5,25,.18]);
      put('nave-window', 'arch', 'glass', 1, [x,8.5,z+side*.12], [3.7,23.8,.18]);
      for (const offset of [-.65,.65]) box('mullion','stone',2,x+offset,18,z+side*.25,.12,19,.12);
      box('wall-pier','brickLight',1,x-3.6,18.5,z, .85,37,.5);
    }
    box('eaves', 'stone', 1, -7,36.7,side*20.4,95,.65,.65);
    // Roof ribs are deliberately sparse and only drawn nearby.
    for(let i=0;i<10;i++) {
      const x=-45+i*9;
      box('roof-seam','brickLight',2,x,48.55,side*10.3,.12,30.85,.12,[-side*.73,0,0]);
    }
  }
  // Western front: twin square towers, octagonal upper stages, broad Welsche Hauben.
  for (const side of [-1,1]) {
    const z=side*13, x=-46.5;
    box('tower-shaft','brick',0,x,34.5,z,16,69,14);
    put('tower-belfry','octagon','brick',0,[x,76,z],[15,14,14]);
    put('tower-dome','dome','copper',0,[x,89.5,z],[16.5,13,16.5]);
    box('finial','gold',0,x,97.2,z,.22,2.4,.22);
    box('finial-cross','gold',2,x,97.6,z,1.2,.16,.16);
    for (const y of [20,39,57,69,82.8]) box('tower-belt','stone',1,x,y,z,16.3,.55,14.3);
    // West and outward faces have tall belfry openings and stacked lancets.
    for(const y of [25,45,58,72]) {
      const h=y===72?8:11;
      put('west-tower-window','arch','stone',1,[x-8.13,y,z],[3.2,h,.18],[0,Math.PI/2,0]);
      put('west-tower-window-inset','arch','glass',1,[x-8.25,y+.35,z],[2.5,h-.7,.18],[0,Math.PI/2,0]);
      put('outer-tower-window','arch','glass',1,[x,y,z+side*7.16],[2.8,h,.18]);
    }
    // Clock is static architectural detail, not a claim about current local time.
    put('clock-rim','disc','gold',2,[x-8.25,66,z],[4.4,.22,4.4],[0,0,Math.PI/2]);
    put('clock-face','disc','glass',2,[x-8.4,66,z],[3.9,.12,3.9],[0,0,Math.PI/2]);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      box('clock-tick','gold',2,x-8.5,66+1.6*Math.cos(a),z+1.6*Math.sin(a),.08,.36,.12,[a,0,0]);
    }
    box('clock-hand','gold',2,x-8.56,66.55,z,.1,1.3,.12);
    box('clock-hand','gold',2,x-8.56,66,z+.45,.1,.12,1.1);
  }
  put('west-portal-frame','arch','stone',1,[-54.65,0,0],[6.5,10,.35],[0,Math.PI/2,0]);
  put('west-portal','arch','door',1,[-54.9,0,0],[5.1,8.8,.25],[0,Math.PI/2,0]);
  put('west-central-window','arch','glass',1,[-54.65,17,0],[6,17,.2],[0,Math.PI/2,0]);
  return parts;
}

export function oldtownDetailLevel(distance, quality = 'medium') {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  if (quality === 'low') return distance < 450 ? 1 : 0;
  return distance < (quality === 'high' ? 750 : 420) ? 2 : distance < 1800 ? 1 : 0;
}

function polygonGeometry(THREE, vertices, indices) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function makeGeometry(THREE, shape) {
  if (shape === 'box') return new THREE.BoxGeometry(1,1,1);
  if (shape === 'octagon') return new THREE.CylinderGeometry(.5,.5,1,8);
  if (shape === 'disc') return new THREE.CylinderGeometry(.5,.5,1,24);
  if (shape === 'dome') return new THREE.LatheGeometry([
    [0,-.5],[.43,-.5],[.49,-.4],[.5,-.25],[.46,-.06],[.36,.15],[.2,.32],[.07,.43],[0,.5],
  ].map(([r,y])=>new THREE.Vector2(r,y)),20);
  if (shape === 'arch') {
    const s=new THREE.Shape();
    s.moveTo(-.5,0);s.lineTo(.5,0);s.lineTo(.5,.58);
    s.quadraticCurveTo(.5,.83,0,1);s.quadraticCurveTo(-.5,.83,-.5,.58);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false,curveSegments:6});
    geo.translate(0,0,-.5);return geo;
  }
  if (shape === 'roof') return polygonGeometry(THREE,
    [-.5,-.5,-.5, -.5,-.5,.5, -.5,.5,0, .5,-.5,-.5, .5,-.5,.5, .5,.5,0],
    [0,1,2,3,5,4,0,4,1,0,3,4,0,5,3,0,2,5,1,5,2,1,4,5]);
  // Five-sided east choir and the hipped roof, attached to the nave at x=0.
  const outline=[[0,-.5],[.7,-.35],[1,0],[.7,.35],[0,.5]];
  if(shape==='apse') {
    const vertices=outline.flatMap(([x,z])=>[x,-.5,z]).concat(outline.flatMap(([x,z])=>[x,.5,z]));
    const indices=[];
    for(let i=0;i<5;i++){const j=(i+1)%5;indices.push(i,j+5,j,i,i+5,j+5);}
    for(let i=1;i<4;i++)indices.push(0,i,i+1,5,6+i,5+i);
    return polygonGeometry(THREE,vertices,indices);
  }
  if(shape==='apseRoof') return polygonGeometry(THREE,
    [...outline.flatMap(([x,z])=>[x,-.5,z]),0,.5,0],
    [0,5,1,1,5,2,2,5,3,3,5,4,4,5,0,0,1,2,0,2,3,0,3,4]);
  throw new TypeError(`Unknown oldtown shape: ${shape}`);
}

export function createFeature(engine) {
  if (!engine?.THREE || typeof engine.addGeoObject !== 'function') throw new TypeError('Oldtown landmark requires engine.THREE and engine.addGeoObject');
  const THREE=engine.THREE;
  const group=new THREE.Group();group.name='city-landmark-oldtown-frauenkirche';
  group.userData={...OLDTOWN_LANDMARK,sources:OLDTOWN_SOURCES};
  // Rotate only the architectural study; addGeoObject owns the anchor transform.
  const model=new THREE.Group();model.rotation.y=OLDTOWN_LANDMARK.orientation;group.add(model);
  const levels=[0,1,2].map(level=>{const g=new THREE.Group();g.name=`oldtown-detail-${level}`;model.add(g);return g;});
  const geometries=new Map(),materials=new Map(),meshes=[];
  let disposed=false,detach=()=>{},unsubscribe=()=>{},unregister=()=>{},panel;
  function dispose() {
    if(disposed)return;disposed=true;
    unregister();unsubscribe();panel?.dispose();detach();
    group.removeFromParent();
    group.clear();
    for(const mesh of meshes)mesh.dispose();
    for(const geo of geometries.values())geo.dispose();
    for(const material of materials.values())material.dispose();
  }
  try {
    const batches=new Map();
    for(const part of planOldtownLandmark()) {
      const key=`${part.level}:${part.shape}:${part.color}`;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);
    }
    const dummy=new THREE.Object3D();
    for(const parts of batches.values()) {
      const {shape,color,level}=parts[0];
      if(!geometries.has(shape))geometries.set(shape,makeGeometry(THREE,shape));
      if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color:COLORS[color]}));
      const mesh=new THREE.InstancedMesh(geometries.get(shape),materials.get(color),parts.length);
      mesh.name=`oldtown-${level}-${shape}-${color}`;
      parts.forEach((part,i)=>{
        dummy.position.set(...part.position);dummy.scale.set(...part.size);dummy.rotation.set(...part.rotation);
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      levels[level].add(mesh);meshes.push(mesh);
    }
    detach=engine.addGeoObject({group,lon:OLDTOWN_LANDMARK.lon,lat:OLDTOWN_LANDMARK.lat,minZoom:13,maxDistance:6000,replaceBuildings:true});
    if(engine.document && engine.createPanel) {
      panel=engine.createPanel('city-landmark-oldtown-sources',{title:'圣母教堂 · 模型与来源',modal:true});
      const append=(tag,text,parent=panel.body)=>{const el=engine.document.createElement(tag);el.textContent=text;parent.appendChild(el);return el;};
      append('p','双塔、绿色文艺复兴圆顶、砖砌大厅与陡坡屋顶：圣母教堂的简化外观模型。');
      append('p','近似模型 / Approximate model: footprint, roof height, orientation, tower widths and ornament spacing are inferred, not surveyed. Published tower heights inform the silhouette; interior height does not define the roof. Building anchor follows Commons; it is not an arrival point.');
      append('p','Original procedural geometry; no image textures or downloaded models. Sources and visual reference credits:');
      const list=append('ul','');
      for(const source of OLDTOWN_SOURCES) {
        const item=append('li','',list),link=append('a',source.title,item);
        link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
        append('p',source.credit,item);
      }
    }
    function update() {
      if(disposed)return;
      const distance=engine.distance(engine.player,OLDTOWN_LANDMARK);
      const detail=oldtownDetailLevel(distance,engine.getSettings?.().quality);
      levels[1].visible=detail>=1;levels[2].visible=detail>=2;
    }
    unsubscribe=engine.onSettings?.(update)??(()=>{});
    unregister=engine.onDispose?.(dispose)??(()=>{});
    update();
    return {group,sources:OLDTOWN_SOURCES,update,dispose,openSources(){if(!disposed)panel?.open();},isOpen(){return !disposed && !!panel?.isOpen();}};
  } catch(error) {dispose();throw error;}
}
