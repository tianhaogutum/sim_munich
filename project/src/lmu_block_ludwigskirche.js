// South-east LMU block. Static, deterministic and side-effect free until createBlock.
// Survey/placement provenance: assets/osm/ludwigskirche.sources.json.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointInPolygon } from './date_geo.mjs';
import {
  BUILDINGS, FOOTPRINTS, ANNEXES, CHURCH_FRAME, LIBRARY_FRAME,
  LANDMARKS, localPoint, containsBuilding, GARDEN_STEPS, placeRing, ARCHIVE_FRAGMENT, ARCHIVE_FRAME, STAIR_FOOTPRINT,
} from './lmu_block_ludwigskirche_data.mjs';
export { LANDMARKS };

export function createBlock(engine) {
  const { THREE: T } = engine;
  const group = new T.Group();
  group.name = 'lmu-block-ludwigskirche';
  const batches = new Map();
  const unhooks = [];
  const identity = new T.Matrix4();
  const palette = {
    limestone: 0xb5ac94, trim: 0xc6b99a, recess: 0x494644,
    brick: 0xa68b73, rustication: 0x9b947f, mortar: 0x766d5c,
    glass: 0x334c61, roof: 0x4d625c, tileGold: 0xa88b43,
    tileBlue: 0x416674, stone: 0xb2ab9c, paving: 0x9e9786,
    pavingLine: 0x837c6e, grass: 0x788867, trunk: 0x685142,
    foliage: 0x668252, iron: 0x3d484b, gold: 0xb3a15c,
  };
  function frameMatrix(f) {
    const m = new T.Matrix4().makeRotationY(-Math.atan2(f.uz, f.ux));
    m.setPosition(f.x, 0, f.z);
    return m;
  }
  const church = frameMatrix(CHURCH_FRAME);
  const library = frameMatrix(LIBRARY_FRAME);
  function put(geo, key, frame = identity, p = [0, 0, 0], rotation = [0, 0, 0]) {
    const q = new T.Quaternion().setFromEuler(new T.Euler(...rotation));
    const m = new T.Matrix4().compose(new T.Vector3(...p), q, new T.Vector3(1, 1, 1));
    m.premultiply(frame);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    // No texture assets: normalize attributes so all primitive types merge safely.
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(m);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(g);
  }
  function box(key, frame, u, y, v, w, h, d, rotation) {
    put(new T.BoxGeometry(w, h, d), key, frame, [u, y, v], rotation);
  }
  function cylinder(key, frame, u, y, v, rt, rb, h, n = 12) {
    put(new T.CylinderGeometry(rt, rb, h, n), key, frame, [u, y, v]);
  }
  function sphere(key, frame, u, y, v, r, detail = 0, scale = [1,1,1]) {
    const g = new T.IcosahedronGeometry(r, detail); g.scale(...scale);
    put(g, key, frame, [u, y, v]);
  }
  function flatPolygon(points, key, y, height = .08, holes = []) {
    const shape = new T.Shape(points.map(p => new T.Vector2(p.x, -p.z)));
    for (const hole of holes) shape.holes.push(new T.Path(hole.map(p => new T.Vector2(p.x, -p.z))));
    const geo = new T.ExtrudeGeometry(shape, {depth:height, bevelEnabled:false, steps:1, curveSegments:6});
    geo.rotateX(-Math.PI/2); geo.translate(0,y,0); put(geo,key);
  }
  function archShape(w,h) {
    const s = new T.Shape(), r=w/2;
    s.moveTo(-r,0); s.lineTo(r,0); s.lineTo(r,h-r);
    s.absarc(0,h-r,r,0,Math.PI,false); s.closePath(); return s;
  }
  function arch(key, frame, u,y,v,w,h, rotation=[0,0,0]) {
    put(new T.ShapeGeometry(archShape(w,h),12),key,frame,[u,y,v],rotation);
  }
  function archRim(key, frame, u,y,v,w,h,t=.23,rotation=[0,0,0]) {
    const s=archShape(w+2*t,h+t);
    // Open-bottom surround is enough for the silhouette and avoids filled window disks.
    const inner=archShape(w,h); s.holes.push(new T.Path(inner.getPoints(24)));
    put(new T.ShapeGeometry(s,12),key,frame,[u,y,v],rotation);
  }
  function window(frame,u,y,v,w,h,rotation=[0,0,0],rim='trim') {
    arch('glass',frame,u,y,v,w,h,rotation);
    archRim(rim,frame,u,y-.02,v-.035,w,h,.2,rotation);
    // West-facing window mullions are shallow solids, merged into the trim mesh.
    if (rotation[1]===0) {
      box(rim,frame,u,y+h*.43,v-.07,.10,h*.82,.07);
      box(rim,frame,u,y+h*.36,v-.07,w,.09,.07);
      box(rim,frame,u,y-.14,v-.05,w+.55,.22,.40);
    }
  }
  function ring(key,frame,u,y,v,r,t,rot=[0,0,0],segments=32) {
    put(new T.TorusGeometry(r,t,5,segments),key,frame,[u,y,v],rot);
  }
  function rod(key,frame,a,b,r=.07) {
    const va=new T.Vector3(...a),vb=new T.Vector3(...b), d=vb.clone().sub(va);
    const g=new T.CylinderGeometry(r,r,d.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    put(g,key,frame,va.add(vb).multiplyScalar(.5).toArray());
  }
  function gable(frame,u,v,w,length,eaves,rise,key='roof') {
    const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,rise);s.closePath();
    put(new T.ExtrudeGeometry(s,{depth:length,bevelEnabled:false}),key,frame,[u,eaves,v]);
  }
  function hip(frame,u,v,w,d,y,rise,key='roof') {
    const verts=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]];
    const alongU=w>d, ridge=Math.max(w,d)/2-Math.min(w,d)/2;
    const a=alongU?[-ridge,rise,0]:[0,rise,-ridge];
    const b=alongU?[ridge,rise,0]:[0,rise,ridge];
    const faces=alongU?[[verts[0],verts[1],b],[verts[0],b,a],[verts[1],verts[2],b],[verts[2],verts[3],a],[verts[2],a,b],[verts[3],verts[0],a]]:
      [[verts[0],verts[1],a],[verts[1],verts[2],b],[verts[1],b,a],[verts[2],verts[3],b],[verts[3],verts[0],a],[verts[3],a,b]];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flat(2),3));g.computeVertexNormals();
    put(g,key,frame,[u,y,v]);
  }
  function arcade(frame,start,count,bay,base=0,v=0) {
    const h=10.5, radius=(bay-.85)/2, spring=8.4-radius;
    // A concave spandrel polygon keeps the arch OPEN down to the ground.
    // A hole touching an extrusion boundary is not a valid polygon-with-holes.
    const s=new T.Shape();
    s.moveTo(-bay/2,0); s.lineTo(-radius,0); s.lineTo(-radius,spring);
    s.absarc(0,spring,radius,Math.PI,0,true);
    s.lineTo(radius,0);s.lineTo(bay/2,0);s.lineTo(bay/2,h);
    s.lineTo(-bay/2,h);s.closePath();
    for(let i=0;i<count;i++) {
      const u=start+bay*(i+.5);
      put(new T.ExtrudeGeometry(s,{depth:2.2,bevelEnabled:false,curveSegments:12}),'limestone',frame,[u,base,v]);
      archRim('trim',frame,u,base-.02,v-.045,bay-.85,8.4,.25);
    }
    box('trim',frame,start+count*bay/2,base+10.65,v+1.1,count*bay+.9,.45,2.7);
    box('roof',frame,start+count*bay/2,base+10.95,v+1.1,count*bay+1,.18,2.8);
  }

  // Exact OSM ground footprints remain the collision source, including both library courts.
  const lib=BUILDINGS[1];
  flatPolygon(lib.outer,'rustication',.08,5.75,lib.inner);
  flatPolygon(lib.outer,'brick',5.83,15.17,lib.inner);
  flatPolygon(lib.outer,'roof',21,.70,lib.inner);
  flatPolygon(BUILDINGS[0].outer,'limestone',.08,.28);

  // Small facade-relative forecourts only. No road asphalt and no world-space
  // anchor constants: paving follows the same geographic frame as each building.
  box('paving',church,0,.04,-3.5,89,.08,7);
  for(let u=-42;u<=42;u+=4) box('pavingLine',church,u,.09,-3.5,.045,.014,6.8);
  for(let v=-6;v<0;v+=2) box('pavingLine',church,0,.091,v,88,.014,.045);
  box('paving',library,0,.045,-5.3,152,.09,10.6);
  for(let u=-74;u<75;u+=5) box('pavingLine',library,u,.10,-5.3,.045,.014,10.4);

  // ST. LUDWIG: nave, aisles, transept and eastern apse follow the surveyed basilica.
  box('limestone',church,0,19,34,27,30,55);
  box('limestone',church,-17,8.3,31.5,7,16.3,48);
  box('limestone',church,17,8.3,31.5,7,16.3,48);
  box('limestone',church,0,13,53,48,25.6,17);
  // Apse: only the east-facing half cylinder projects beyond the rectangular choir.
  const apse=new T.CylinderGeometry(11.4,11.4,25.7,24,1,false,-Math.PI/2,Math.PI);
  put(apse,'limestone',church,[0,13,61]);
  cylinder('roof',church,0,27,62,0,11.6,4.4,24);
  gable(church,0,7,28,55,34,7.7);
  gable(church,0,44,48,17,25.8,8.3);
  for(const u of [-17,17]) hip(church,u,31,7.6,48,16.5,4);
  // Jewel-colour tile diagonals: low-poly strips embedded on both nave roof slopes.
  const slope=Math.atan2(7.7,14);
  for(let v=9;v<62;v+=4.3) for(const sign of [-1,1]) {
    box((Math.round(v/4.3)%2)?'tileGold':'tileBlue',church,sign*7,37.96,v,15.98,.075,.34,[0,0,-sign*slope]);
    box('tileGold',church,sign*10,36.2,v+1.7,1.5,.10,1.5,[0,0,-sign*slope]);
  }
  // A genuinely open three-arch portico, beneath the rose-window wall and gable.
  arcade(church,-12.75,3,8.5,0,0);
  box('limestone',church,0,23.6,1.7,28,25.4,3.4);
  gable(church,0,-.04,28,3.5,36.3,5.4,'limestone');
  rod('trim',church,[-14,36.3,-.17],[0,41.7,-.17],.22);
  rod('trim',church,[0,41.7,-.17],[14,36.3,-.17],.22);
  // The nave body begins behind the porch: three recessed timber doors.
  for(const u of [-8.5,0,8.5]) {
    arch('recess',church,u,.45,6.35,5.4,9.2);
    archRim('trim',church,u,.45,6.25,5.4,9.2,.26);
    box('gold',church,u,4,6.2,.11,6.8,.07);
  }
  for(let i=0;i<7;i++) box('stone',church,0,(i+.5)*.075,-3.8+i*.52,25,.075,7.5-i*.52);
  // Five statues in the arcaded gallery below the rose.
  for(let i=-2;i<=2;i++) {
    window(church,i*4.3,17.3,-.075,2.25,5.1);
    cylinder('trim',church,i*4.3,18.5,-.31,.48,.67,2.3,8);
    sphere('trim',church,i*4.3,20.1,-.31,.40,1);
  }
  box('trim',church,0,15.3,-.16,28.5,.75,.65);
  box('trim',church,0,23.8,-.16,28.5,.35,.50);
  // Rose window: stone rings, twelve radial mullions, lobes and a central medallion.
  put(new T.CircleGeometry(3.5,48),'glass',church,[0,29.35,-.12]);
  ring('trim',church,0,29.35,-.20,3.75,.32);
  ring('trim',church,0,29.35,-.22,3.35,.13);
  ring('trim',church,0,29.35,-.25,1.12,.11);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    rod('trim',church,[Math.sin(a)*.5,29.35+Math.cos(a)*.5,-.28],[Math.sin(a)*3.4,29.35+Math.cos(a)*3.4,-.28],.085);
    ring('trim',church,Math.sin(a)*2.52,29.35+Math.cos(a)*2.52,-.3,.53,.075,[0,0,0],12);
  }
  cylinder('gold',church,0,43.05,1.7,.09,.09,3,8);
  box('gold',church,0,43.4,1.7,1.4,.13,.13);

  // Twin 71 m towers: staged shafts, bell openings, clocks, friezes and pyramidal spires.
  for(const sign of [-1,1]) {
    const u=sign*19.8,v=4.5;
    box('limestone',church,u,12.5,v,9.4,25,9.4);
    box('limestone',church,u,34,v,8.4,18,8.4);
    box('limestone',church,u,49,v,7.5,12,7.5);
    for(const [y,w] of [[.6,9.8],[14.8,9.8],[25.1,9.2],[43.1,8.8],[55.1,8.4]]) {
      box('trim',church,u,y,v,w,.6,w);
      box('mortar',church,u,y-.38,v,w-.1,.13,w-.1);
    }
    for(const y of [17,29]) window(church,u,y,v-4.77,1.65,4.8);
    for(const side of [-1,1]) {
      window(church,u+side*1.25,44.2,v-3.81,1.7,5.9);
      for(let y=45;y<49.5;y+=.46) box('recess',church,u+side*1.25,y,v-3.88,1.45,.14,.06);
      window(church,u+3.79,44.2,v+side*1.25,1.7,5.9,[0,Math.PI/2,0]);
    }
    put(new T.CircleGeometry(1.13,24),'recess',church,[u,52.3,v-3.81]);
    ring('gold',church,u,52.3,v-3.86,1.17,.065);
    rod('gold',church,[u,52.3,v-3.9],[u,53.12,v-3.9],.055);
    rod('gold',church,[u,52.3,v-3.9],[u+.65,52,v-3.9],.055);
    for(let i=-3;i<=3;i++) {
      archRim('trim',church,u+i,53.85,v-3.83,.65,1.15,.12);
      box('trim',church,u+i,42.25,v-4.5,.4,.6,.25);
    }
    cylinder('roof',church,u,62.15,v,0,5.2,14.2,4);
    // Cone's corner radius is sqrt(2) times half width; its base stays on the tower.
    cylinder('gold',church,u,69.65,v,.16,.16,.65,8);
    cylinder('gold',church,u,70.2,v,.075,.075,1.6,8);
    box('gold',church,u,70.45,v,.92,.12,.12);
  }
  // Clear side-window rhythm and buttresses distinguish the nave from a plain block.
  for(let v=15;v<=56;v+=8.2) for(const sign of [-1,1]) {
    window(church,sign*13.58,24,v,2.9,6.8,[0,sign*Math.PI/2,0]);
    box('trim',church,sign*20.65,8.8,v,1,17.2,1.25);
    box('trim',church,sign*14,29,v,1,10,1);
  }
  for(const a of ANNEXES) {
    box('limestone',church,a.u,7.9,a.v,a.width,15.5,a.depth);
    box('trim',church,a.u,15.7,a.v,a.width+.5,.5,a.depth+.5);
    hip(church,a.u,a.v,a.width+.7,a.depth+.7,16,3.8);
    for(let u=-7.2;u<8;u+=4.8) {
      window(church,a.u+u,3.1,-.07,1.65,3.5);
      window(church,a.u+u,9,-.07,1.65,3.5);
    }
  }
  arcade(church,23.8,5,3.54,0,0);
  arcade(church,-41.5,5,3.54,0,0);

  // STAATSBIBLIOTHEK: 27 bays, three doorways, two tiers of arched windows.
  for(const [y,h] of [[.5,.65],[5.8,.55],[13.6,.35],[20.65,.65],[21.45,.35]]) {
    box('trim',library,0,y,-.18,152.2,h,.65);
  }
  for(let bay=0;bay<27;bay++) {
    const u=-72+bay*144/26;
    window(library,u,7,-.07,2.45,5.2,[0,0,0],'rustication');
    window(library,u,15,-.07,2.2,4.6,[0,0,0],'rustication');
    if(Math.abs(u)>9) window(library,u,1.05,-.07,2.1,3.7);
    box('trim',library,u,20.3,-.32,.35,.75,.5);
  }
  // Individual joints give the ground storey a legible Florentine rustication.
  for(let y=.9;y<5.7;y+=.6) {
    box('mortar',library,0,y,-.055,152,.04,.04);
    for(let u=-74.5+(Math.round(y/.6)%2)*1.5;u<76;u+=3) {
      if(Math.abs(u)>10) box('mortar',library,u,y-.3,-.06,.045,.57,.035);
    }
  }
  for(const u of [-6,0,6]) {
    arch('recess',library,u,2.1,-.16,4.9,6.5);
    archRim('trim',library,u,2.1,-.20,4.9,6.5,.48);
    // Radial voussoirs around each main portal.
    for(let a=0;a<=Math.PI;a+=Math.PI/12) {
      const x=u+Math.cos(a)*2.7,y=6.15+Math.sin(a)*2.7;
      box('mortar',library,x,y,-.24,.045,.52,.04,[0,0,a-Math.PI/2]);
    }
    box('gold',library,u,4.2,-.27,.09,4.2,.09);
    box('trim',library,u,3.1,-.26,4.7,.08,.08);
  }
  // Long shallow gabled roofs retain the library's two open courtyards.
  // Shallow hips and narrow end ridges leave both OSM courtyard voids open.
  hip(library,0,9.1,152,18.2,21.6,3.2);
  for(const u of [-67,67]) hip(library,u,39,17.8,60,21.6,3.2);
  hip(library,0,68.9,152,17.6,21.6,3.2);
  hip(library,0,39,10.5,59,21.6,3.0);

  // Grand split stair: two flights ascend along the facade to a central landing.
  box('stone',library,0,1.1,-4.6,22,2.2,8.8);
  for(const sign of [-1,1]) {
    for(let i=0;i<12;i++) {
      const h=(i+1)*2.2/12;
      box('stone',library,sign*(22.4-i*.95),h/2,-4.6,.98,h,7.7);
    }
    // Parapets follow the stair incline; turned balusters remain simple merged primitives.
    rod('trim',library,[sign*23.1,.85,-8.55],[sign*11.2,3.0,-8.55],.18);
    rod('trim',library,[sign*23.1,.85,-.65],[sign*11.2,3.0,-.65],.18);
    for(let i=0;i<12;i++) {
      const u=sign*(22.8-i),h=(i+1)*2.2/12;
      for(const v of [-8.55,-.65]) cylinder('trim',library,u,h+.4,v,.075,.11,.8,6);
    }
  }
  box('trim',library,0,3.02,-8.6,23,.28,.40);
  for(let u=-10.5;u<=10.5;u+=.75) cylinder('trim',library,u,2.62,-8.6,.07,.11,.65,6);
  // Four scholars, north-to-south: Thucydides, Homer, Aristotle, Hippocrates.
  for(const [i,u] of [15,5,-5,-15].entries()) {
    const v=-8.5;
    box('stone',library,u,2.6,v,1.75,.8,1.75);
    box('trim',library,u,3.05,v,1.92,.18,1.92);
    box('mortar',library,u,2.66,v-.89,.9,.25,.04);
    box('stone',library,u,3.9,v+.3,1.25,1.55,.38); // chair back
    cylinder('stone',library,u,4.15,v,.43,.64,1.25,8); // draped torso
    sphere('stone',library,u,5.02,v-.10,.33,1,[.87,1.12,.90]);
    sphere('trim',library,u,4.83,v-.32,.23,0,[.8,1,.65]); // beard
    box('stone',library,u,3.65,v-.38,1.25,.55,1.15); // lap
    for(const side of [-1,1]) {
      cylinder('stone',library,u+side*.34,3.36,v-.72,.18,.24,.65,8);
      box('stone',library,u+side*.34,3.1,v-.86,.40,.18,.61);
      rod('stone',library,[u+side*.52,4.5,v-.02],[u+side*.43,3.94,v-.66],.13);
    }
    // A scroll or open tablet is a readable icon of scholarship.
    if(i%2===0) box('trim',library,u,3.97,v-.7,.7,.1,.5,[.18,0,0]);
    else cylinder('trim',library,u,3.95,v-.69,.10,.10,.78,8);
  }

  // The clipped northern side wing of the Hauptstaatsarchiv, Ludwigstrasse 14.
  // Its main central entrance is south of our boundary and is deliberately omitted.
  flatPolygon(ARCHIVE_FRAGMENT.outer,'limestone',.08,14.9);
  flatPolygon(ARCHIVE_FRAGMENT.outer,'trim',14.98,.45);
  const archive=frameMatrix(ARCHIVE_FRAME);
  box('trim',archive,.12,6.5,36.5,.35,.45,73);
  box('trim',archive,.12,14.6,36.5,.45,.55,73);
  for(let v=4;v<70;v+=5.8) {
    for(const y of [1.6,8.3]) window(archive,.05,y,v,2.2,4.8,[0,Math.PI/2,0]);
    box('trim',archive,.16,14.15,v,.25,.45,.32);
  }

  // Quiet planted courts and a few low-poly trees; no artificial road surface.
  for(const hole of lib.inner) flatPolygon(hole,'grass',.085,.035);
  for(const [u,v,r] of [[-32,36,3.8],[33,35,4],[-33,46,3.5],[34,46,3.8]]) {
    cylinder('trunk',library,u,3,v,.28,.40,6,8);
    sphere('foliage',library,u,7.2,v,r,1,[1,1.18,1]);
  }
  // Exact OSM endpoints and step counts determine these two rear-garden runs.
  for(const stair of GARDEN_STEPS) {
    const [a,b]=placeRing(stair.ring), dx=b.x-a.x,dz=b.z-a.z;
    const length=Math.hypot(dx,dz),depth=length/stair.count;
    const f={x:a.x,z:a.z,ux:dz/length,uz:-dx/length},m=frameMatrix(f);
    for(let i=0;i<stair.count;i++) {
      const height=(i+1)*.12;
      box('stone',m,0,height/2,(i+.5)*depth,1.8,height,depth+.015);
    }
  }

  // The exact footprints and the estimated solid piers all unregister on disposal.
  unhooks.push(engine.addBlocker((x,z) => FOOTPRINTS.some(b=>containsBuilding(b,x,z))));
  // Staircase/statue plinths are also solid at ground level; no inaccessible POI is placed on them.
  unhooks.push(engine.addBlocker((x,z)=>pointInPolygon(x,z,STAIR_FOOTPRINT)));

  for(const [key,geos] of batches) {
    const material=engine.toon(palette[key],key==='foliage'?3:4,{side:T.DoubleSide});
    const geometry=mergeGeometries(geos,false);
    for(const g of geos)g.dispose();
    geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);mesh.name=`ludwigskirche-${key}`;
    mesh.receiveShadow=true;mesh.castShadow=false;
    // One inverted hull per major architectural material, never per window/column.
    if(key==='limestone'||key==='brick') engine.outline(mesh,.045);
    group.add(mesh);
  }
  group.userData={
    block:'ludwigskirche',static:true,buildingCount:BUILDINGS.length+ANNEXES.length+1,
    windowBays:27,towerHeight:71,scholarCount:4,
    meshCount:group.children.length,
    drawCallBudget:group.children.length+2,
    placement: 'date_geo.toWorld (unshifted)',
  };
  engine.scene.add(group);
  let disposed=false;
  return {group,dispose(){
    if(disposed)return;disposed=true;
    for(const unhook of unhooks)if(typeof unhook==='function')unhook();
    group.removeFromParent();
    const geometries=new Set(),mats=new Set();
    group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))mats.add(m);});
    for(const geometry of geometries)geometry.dispose();
    for(const material of mats)material.dispose();
  }};
}
