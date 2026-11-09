import { createLifeSimulation, seededRandom, distance, compileLane, laneAtTime } from './lmu_life_sim.mjs';
import { LANES } from './lmu_block_ludwigstrasse_plan.mjs';

/** Cheap ambient life. Only the engine contract is used; no global game state. */
export function createLife(engine, story) {
  const T = engine.THREE;
  const root = new T.Group(); root.name = 'LMU ambient life'; engine.scene.add(root);
  const random = seededRandom(20261109);
  const blocked = engine.blocked ? (x, z) => engine.blocked(x, z) : () => false;
  // Mapped streets replaced the old perpendicular road. Keep ambient walkers
  // on the west pedestrian forecourt, with collision-checked starting points.
  const clear = (x,z,r=.7) => [[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([a,b])=>!blocked(x+a,z+b));
  const walkPoints=[];
  for(const x of [-52,-40,-29,-16,-5,8,20,32]) for(const z of [20,30,40,50])
    if(z<77+.315*x-18 && clear(x,z)) walkPoints.push([x,z]);
  const routes = walkPoints.length>=2 ? Array.from({length:4},(_,n)=>walkPoints.filter((_,i)=>i%4===n||i===0)) : undefined;
  const safeRoutes=routes?.map(r=>r.length>=2?r:walkPoints.slice(0,2));
  const flockStarts=(walkPoints.filter(([x,z])=>clear(x,z,2.8)).slice(0,4));
  const sim = createLifeSimulation({ blocked, random, routes:safeRoutes, flockStarts:flockStarts.length===4?flockStarts:undefined });
  const lanes = mode => LANES.filter(l=>l.mode===mode).map(l=>({...l,compiled:compileLane(l.points)})).filter(l=>l.compiled).sort((a,b)=>b.compiled.length-a.compiled.length);
  const motorLanes=lanes('motor'), cycleLanes=lanes('cycle');
  // The central lane of the longest three-lane carriageway leaves kerb clearance.
  const busLane=(motorLanes[1]??motorLanes[0])?.compiled;
  const cyclePaths=Array.from({length:4},(_,i)=>cycleLanes[i%cycleLanes.length]?.compiled);
  const geometries = new Set(), materials = new Set(), batches = [];
  const painted = engine.toon(0xffffff, 4, { vertexColors: true }); materials.add(painted);
  const matrix = new T.Matrix4(), local = new T.Matrix4(), world = new T.Matrix4();
  const pos = new T.Vector3(), scale = new T.Vector3(), quat = new T.Quaternion(), euler = new T.Euler();
  const color = new T.Color();
  const hip = new T.Vector3(), foot = new T.Vector3(), knee = new T.Vector3();
  const direction = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const sphere = (r = 1) => new T.SphereGeometry(r, 8, 6);
  const box = () => new T.BoxGeometry(1, 1, 1);
  const capsule = (r, length) => new T.CapsuleGeometry(r, length, 3, 7);
  const cylinder = (r, length, r2 = r) => new T.CylinderGeometry(r, r2, length, 8);
  function piece(geo, xyz, size, rgb, rotation = [0,0,0]) {
    pos.set(...xyz); scale.set(...size); quat.setFromEuler(euler.set(...rotation));
    matrix.compose(pos, quat, scale); geo.applyMatrix4(matrix);
    const c = new Float32Array(geo.attributes.position.count * 3); color.setHex(rgb);
    for (let i = 0; i < c.length; i += 3) { c[i] = color.r; c[i+1] = color.g; c[i+2] = color.b; }
    geo.setAttribute('color', new T.BufferAttribute(c, 3));
    return geo;
  }
  function merge(parts) {
    const flat = parts.map(g => g.index ? g.toNonIndexed() : g);
    const out = new T.BufferGeometry();
    for (const attr of ['position', 'normal', 'color']) {
      const data = new Float32Array(flat.reduce((n, g) => n + g.attributes[attr].array.length, 0));
      let offset = 0;
      for (const g of flat) { data.set(g.attributes[attr].array, offset); offset += g.attributes[attr].array.length; }
      out.setAttribute(attr, new T.BufferAttribute(data, 3));
    }
    new Set([...parts, ...flat]).forEach(g => g.dispose());
    geometries.add(out); return out;
  }
  const P = piece;
  function batch(name, geometry, count, material = painted) {
    const m = new T.InstancedMesh(geometry, material, count);
    m.name = name; m.frustumCulled = false; m.castShadow = false;
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < count; i++) m.setColorAt(i, new T.Color(0xffffff));
    root.add(m); batches.push(m); return m;
  }
  function tint(mesh, i, rgb) { mesh.setColorAt(i, color.setHex(rgb)); }
  function at(x, y, z, yaw = 0, lean = 0) {
    pos.set(x,y,z); quat.setFromEuler(euler.set(0,yaw,lean)); scale.set(1,1,1); world.compose(pos,quat,scale);
  }
  function put(mesh, i, x=0, y=0, z=0, rx=0, ry=0, rz=0, sx=1, sy=1, sz=1) {
    pos.set(x,y,z); quat.setFromEuler(euler.set(rx,ry,rz)); scale.set(sx,sy,sz);
    local.compose(pos,quat,scale); matrix.multiplyMatrices(world,local); mesh.setMatrixAt(i,matrix);
  }

  // All the plumage, eyes and feet are baked into shared low-poly geometry.
  const birds = batch('pigeons / iridescent bodies', merge([
    P(sphere(),[0,0,0],[.27,.23,.38],0x87929e),
    P(sphere(),[0,.19,.23],[.135,.22,.14],0x437976),
    P(sphere(),[0,.35,.29],[.15,.145,.16],0x929cac),
    P(cylinder(.065,.18,0),[0,.34,.49],[1,1,1],0xd9b078,[Math.PI/2,0,0]),
    P(sphere(),[-.128,.39,.34],[.028,.028,.028],0x15182b),
    P(sphere(),[.128,.39,.34],[.028,.028,.028],0x15182b),
    P(box(),[0,-.01,-.35],[.24,.07,.28],0x343e56,[-.1,0,0]),
  ]),24);
  const wings = batch('pigeons / flapping wings', merge([
    P(sphere(),[0,0,-.03],[.28,.065,.32],0x5b687f),
    P(box(),[.1,-.015,-.14],[.26,.03,.075],0x303c56,[0,-.18,0]),
  ]),48);
  const feet = batch('pigeons / coral feet', merge([
    ...[-1,1].flatMap(s => [P(cylinder(.018,.14),[s*.085,-.21,.035],[1,1,1],0xa95d61),
      P(box(),[s*.085,-.27,.09],[.075,.025,.14],0xa95d61)]),
  ]),24);
  const birdOffsets = Array.from({length:24},(_,i) => {
    const a = i % 6 / 6 * Math.PI * 2 + Math.floor(i/6)*.6;
    return { x: Math.cos(a)*(1.1+random()*.7), z: Math.sin(a)*(1.1+random()*.7), phase: random()*Math.PI*2, yaw: random()*Math.PI*2 };
  });

  const coatPalette = [0xd78464,0x809da2,0xc8b47e,0x526986,0xa887aa,0x769387,0xbbb4a3,0xbc6976,0x60778e,0xd8ba84];
  const coats = batch('students / coats', merge([
    P(capsule(.23,.48),[0,1.13,0],[1,.95,.75],0xffffff),
    P(cylinder(.25,.34,.30),[0,.88,0],[1,1,.76],0xe4e2df),
    ...[.93,1.09,1.25].map(y=>P(sphere(),[0,y,.177],[.028,.028,.02],0x3f3c48)),
  ]),10);
  const heads = batch('students / faces and hair', merge([
    P(sphere(),[0,0,0],[.19,.235,.185],0xefc7a3),
    P(sphere(),[0,.095,-.04],[.2,.17,.17],0x39313c),
    P(box(),[-.17,.025,-.03],[.07,.18,.23],0x39313c),
    P(sphere(),[0,.055,.12],[.15,.08,.07],0x39313c),
    P(sphere(),[-.067,-.006,.17],[.014,.022,.012],0x303144),
    P(sphere(),[.067,-.006,.17],[.014,.022,.012],0x303144),
  ]),10);
  const arms = batch('students / swinging sleeves', merge([
    P(capsule(.09,.38),[0,-.2,0],[1,1,1],0xffffff),
    P(sphere(),[0,-.46,0],[.075,.09,.075],0xefc7a3),
  ]),20);
  const legs = batch('students / trousers and shoes', merge([
    P(capsule(.085,.17),[0,-.15,0],[1,1,1],0x303b50),
  ]),20);
  const shins = batch('students / lower legs and shoes', merge([
    P(capsule(.08,.15),[0,-.14,0],[1,1,1],0x303b50),
    P(box(),[0,-.27,.06],[.18,.12,.30],0x242939),
    P(box(),[0,-.32,.07],[.18,.027,.31],0xe2d5bc),
  ]),20);
  const scarves = batch('students / scarves', merge([
    P(new T.TorusGeometry(.16,.045,5,9),[0,1.48,0],[1,.8,1],0xffffff,[Math.PI/2,0,0]),
    P(box(),[-.1,1.24,.19],[.13,.36,.055],0xffffff,[.05,0,-.07]),
  ]),10);
  const bags = batch('students / backpacks', merge([
    P(box(),[0,1.14,-.23],[.34,.41,.19],0x4a4e66),
    P(box(),[0,1.06,-.34],[.28,.14,.045],0x988274),
    ...[-1,1].map(s=>P(box(),[s*.14,1.22,.12],[.045,.42,.055],0x45485d)),
  ]),4);
  for(let i=0;i<10;i++) { tint(coats,i,coatPalette[i]); tint(arms,i*2,coatPalette[i]); tint(arms,i*2+1,coatPalette[i]); tint(scarves,i,[0xe1b15f,0xae5362,0xc3d8cf,0xe7b9aa][i%4]); }

  function rod(a,b,r,rgb) {
    const av = new T.Vector3(...a), bv = new T.Vector3(...b), d=bv.clone().sub(av);
    const g = cylinder(r,d.length());
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    return P(g,av.add(bv).multiplyScalar(.5).toArray(),[1,1,1],rgb);
  }
  const wheels = batch('bicycles / tyres rims and spokes',merge([
    P(new T.TorusGeometry(.35,.04,5,14),[0,0,0],[1,1,1],0x303745,[0,Math.PI/2,0]),
    P(new T.TorusGeometry(.31,.013,4,14),[0,0,0],[1,1,1],0xc7d1d1,[0,Math.PI/2,0]),
    ...Array.from({length:6},(_,i)=> { const a=i*Math.PI/3; return rod([0,0,0],[0,Math.sin(a)*.3,Math.cos(a)*.3],.008,0xa7b3bd); }),
    P(cylinder(.05,.16),[0,0,0],[1,1,1],0xb3bdc6,[0,0,Math.PI/2]),
  ]),8);
  const frameColor=0xa24f58;
  const frames = batch('bicycles / frames',merge([
    ...[[[0,.36,-.58],[0,.4,.02]],[[0,.36,-.58],[0,.92,-.2]],[[0,.4,.02],[0,.92,-.2]],[[0,.92,-.2],[0,.98,.43]],[[0,.4,.02],[0,.98,.43]],[[0,.98,.43],[0,.36,.64]]].map(([a,b])=>rod(a,b,.034,frameColor)),
    rod([0,.85,-.2],[0,1.04,-.2],.03,0x6a7883),
    P(box(),[0,1.06,-.23],[.25,.07,.30],0x303745),
    rod([0,1.0,.40],[0,1.2,.48],.03,0xa8b4bf),
    rod([-.26,1.2,.48],[.26,1.2,.48],.03,0x333c4b),
  ]),4);
  const riders = batch('cyclists / jackets',merge([
    P(capsule(.22,.40),[0,0,0],[1,1,.8],0xffffff),
    ...[-1,1].map(s=>rod([s*.21,.12,.05],[s*.23,-.2,.46],.075,0xe4e1d8)),
  ]),4);
  const helmets = batch('cyclists / heads and helmets',merge([
    P(sphere(),[0,0,0],[.18,.22,.18],0xefc7a3),
    P(sphere(),[0,.13,-.015],[.205,.155,.205],0xe4b965),
    P(box(),[0,.15,.0],[.055,.10,.39],0x4c5968),
  ]),4);
  const pedals = batch('cyclists / pedalling legs',merge([
    P(capsule(.075,.28),[0,-.15,0],[1,1,1],0x3b4760),
  ]),16);
  const cyclistColors = [0x7b99b2,0xcf8069,0x849b79,0xb796bd];
  cyclistColors.forEach((c,i)=>tint(riders,i,c));

  // A generic city bus on one continuous surveyed motor lane. This is ambient
  // scenery, not a claim about a real service number or timetable.
  const bus = new T.Group(); bus.name='Ludwigstraße / city bus'; root.add(bus);
  function busMesh(name,parts,material=painted) { const m=new T.Mesh(merge(parts),material);m.name=name;bus.add(m);return m; }
  const body=[P(box(),[0,1.75,0],[2.5,2.7,10.4],0xe2e4de),P(box(),[0,3.14,0],[2.38,.12,10.15],0xbac2bd)];
  const trim=[P(box(),[0,.75,0],[2.54,.55,10.42],0x428994),P(box(),[0,3.03,0],[2.54,.12,10.42],0x428994)];
  const panes=[], gear=[];
  for(const side of [-1,1]) {
    for(const z of [-4,-2.4,-.8,.8,2.4,4]) panes.push(P(box(),[side*1.265,2.2,z],[.025,1.18,1.4],0xffffff));
    for(const z of [-3.5,3.5])gear.push(P(cylinder(.45,.22),[side*1.16,.47,z],[1,1,1],0x252d32,[0,0,Math.PI/2]));
  }
  panes.push(P(box(),[0,2.15,5.22],[2.18,1.25,.025],0xffffff));
  trim.push(P(box(),[0,2.99,5.25],[1.6,.22,.04],0x1d333a),P(box(),[0,3,5.28],[.9,.07,.02],0xdacb8b));
  for(const x of [-.9,.9])trim.push(P(box(),[x,.95,5.24],[.32,.18,.025],0xffe6aa),P(box(),[x,.95,-5.24],[.22,.22,.025],0xad4546));
  busMesh('bus / body',body);busMesh('bus / blue trim',trim);
  const windowMaterial=engine.toon(0x253e50,4,{vertexColors:true,emissive:0xe0a760,emissiveIntensity:.025});materials.add(windowMaterial);
  busMesh('bus / windows',panes,windowMaterial);busMesh('bus / wheels',gear);

  let density=1, disposed=false, elapsed=0;
  function update(dt=0,et) {
    if(disposed) return;
    dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
    elapsed=Number.isFinite(et)?et:elapsed+dt;
    const player=engine.player?.pos;
    const companion=engine.companion?.getPosition?.();
    const stage=story?.getState?.()?.stage;
    sim.update(dt,elapsed,player,companion,stage);
    const busState=laneAtTime(busLane,elapsed,6.5,8,10);
    const birdCount=Math.round(24*density), peopleCount=Math.round(10*density), cycleCount=Math.round(4*density);
    birds.count=feet.count=birdCount; wings.count=birdCount*2;
    for(let i=0;i<birdCount;i++) {
      const flock=sim.flocks[Math.floor(i/6)], o=birdOffsets[i], flying=flock.state==='flight';
      const flutter=Math.sin(elapsed*(flying?26:3)+o.phase);
      let x=flock.x+o.x, z=flock.z+o.z;
      const wanderX=Math.sin(elapsed*.38+o.phase)*.35, wanderZ=Math.cos(elapsed*.43+o.phase)*.35;
      if(!flying && !blocked(x+wanderX,z+wanderZ)) { x+=wanderX; z+=wanderZ; }
      // If the companion moves into an individual bird's footprint, lift it
      // immediately; group takeoff follows on the next simulation step.
      const personalLift=!flying && companion && Math.hypot(x-companion.x,z-companion.z)<3 ? 3.3 : 0;
      const yaw=flying?Math.atan2(flock.to.x-flock.from.x,flock.to.z-flock.from.z)+Math.sin(flock.time)*.25:o.yaw+Math.sin(elapsed*.38+o.phase)*.5;
      const y=.38+flock.y+personalLift+(flying?Math.sin(o.phase+flock.time*2)*.25:0);
      const peck=!flying && Math.sin(elapsed*1.8+o.phase)>.65?.42:0;
      at(x,y,z,yaw); put(birds,i,0,0,0,peck); put(feet,i,0,0,0, flying?.65:0);
      const flap=(flying||personalLift) ? .25+flutter*.9 : .04+flutter*.035;
      const spread=flying||personalLift ? 1 : .55;
      const reach=flying||personalLift ? .15+.23*Math.cos(flap) : .18;
      const lift=.04+(flying||personalLift ? .23*Math.sin(flap) : 0);
      put(wings,i*2,-reach,lift,0,0,0,-flap,spread,1,1);
      put(wings,i*2+1,reach,lift,0,0,0,flap,spread,1,1);
    }
    coats.count=heads.count=scarves.count=peopleCount; arms.count=legs.count=shins.count=peopleCount*2; bags.count=Math.min(4,Math.ceil(peopleCount*.4));
    for(let i=0;i<peopleCount;i++) {
      const p=sim.pedestrians[i], sitting=p.seated&&p.idle>0;
      const swing=p.moving?Math.sin(p.phase)*.40:0, bob=p.moving?Math.abs(Math.sin(p.phase))*.022:0;
      at(p.x,.13+bob-(sitting?.08:0),p.z,p.yaw);
      put(coats,i); put(heads,i,0,1.70,0,0,Math.sin(elapsed*.45+i)*.10); put(scarves,i);
      put(arms,i*2,-.3,1.34,0,sitting?-.5:swing,0,-.08);
      put(arms,i*2+1,.3,1.34,0,sitting?-.5:-swing,0,.08);
      for(let side=0;side<2;side++) {
        const x=side ? .13 : -.13, angle=sitting ? -Math.PI/2 : (side ? swing : -swing);
        put(legs,i*2+side,x,.66,0,angle);
        put(shins,i*2+side,x,.66-Math.cos(angle)*.30,-Math.sin(angle)*.30,sitting ? 0 : angle);
      }
      if(i<bags.count) put(bags,i);
    }
    wheels.count=cycleCount*2; frames.count=riders.count=helmets.count=cycleCount; pedals.count=cycleCount*4;
    for(let i=0;i<cycleCount;i++) {
      const ride=laneAtTime(cyclePaths[i],elapsed,4.5+i*.3,i*13,3);
      // Hide the short pause at a source-way endpoint without connecting it to an unrelated way.
      at(ride.x,ride.visible ? .12 : -100,ride.z,ride.yaw,Math.sin(elapsed*.9+i)*.025);
      put(frames,i); put(wheels,i*2,0,.36,-.58,elapsed*12); put(wheels,i*2+1,0,.36,.64,elapsed*12);
      put(riders,i,0,1.39,-.04,.30); put(helmets,i,0,1.95,.16,.12);
      for(let s=0;s<2;s++) {
        const a=elapsed*7+s*Math.PI+i;
        hip.set((s?1:-1)*.15,1.08,-.17);
        foot.set((s?1:-1)*.15,.43+Math.sin(a)*.16,.04+Math.cos(a)*.16);
        knee.set(hip.x,(hip.y+foot.y)*.5+.04,(hip.z+foot.z)*.5+.20);
        for(let j=0;j<2;j++) {
          const a=j===0?hip:knee, b=j===0?knee:foot;
          direction.subVectors(b,a);
          const length=direction.length();
          pos.addVectors(a,b).multiplyScalar(.5);
          quat.setFromUnitVectors(up,direction.normalize()); scale.set(1,length/.43,1);
          local.compose(pos,quat,scale); matrix.multiplyMatrices(world,local);
          // Leg geometry runs downward from the joint. Centre it on the bone.
          local.makeTranslation(0,.15,0); matrix.multiply(local); pedals.setMatrixAt(i*4+s*2+j,matrix);
        }
      }
    }
    bus.visible=density>0&&busState.visible;
    bus.position.set(busState.x,.10,busState.z);bus.rotation.y=busState.yaw;
    windowMaterial.emissiveIntensity=(stage==='postcard'||stage==='done') ? .20 : .025;
    batches.forEach(b=>{ b.instanceMatrix.needsUpdate=true; });
  }
  function setDensity(value) { density=Number.isFinite(value)?Math.max(0,Math.min(1,value)):1; update(0,elapsed); }
  function dispose() {
    if(disposed) return; disposed=true; root.removeFromParent();
    batches.forEach(b=>b.dispose()); geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
  }
  update(0,0);
  return { update,setDensity,dispose, getTransportState:()=>({bus:laneAtTime(busLane,elapsed,6.5,8,10),cyclePaths:cyclePaths.length,source:'OpenStreetMap lane geometry',liveService:false}) };
}
