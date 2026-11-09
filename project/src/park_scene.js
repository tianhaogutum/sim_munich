import { BOUNDS, STREAM, BRIDGES, SIGHTS, TREES, TEMPLE, TOWER, streamCenter, streamWidth, terrainHeight, heightAt, blocked } from './park_layout.mjs';

// Procedural toon adaptation of the old meadow, riverbank, pavilion and skyline.
// Every placement shares park_layout.mjs; no legacy world/asset loader is executed.
export function createParkScene(engine) {
  const { THREE, scene, toon, outline } = engine;
  const root = new THREE.Group(); root.name = 'chapter-two-park'; scene.add(root);
  const mat = {
    grass: toon(0x82b970, 3, { vertexColors: true }), path: toon(0xd7c59f),
    wood: toon(0x96633f), woodLight: toon(0xc18d55), iron: toon(0x343743),
    stone: toon(0xf5e6bd), trim: toon(0xd4ba85), copper: toon(0x588b85),
    trunk: toon(0x76533d, 3), green: toon(0xffffff, 3),
    water: new THREE.MeshBasicMaterial({ color: 0x408b9d }),
    bank: toon(0x84996b, 3), cream: toon(0xffebbf), pink: toon(0xffb3c5, 3),
    glow: toon(0xffd594, 3, { emissive: 0xffaa55, emissiveIntensity: 1.15 }),
  };
  function mesh(geo, material, x, y, z, parent=root, ink=true) {
    const m = new THREE.Mesh(geo, material); m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = true; parent.add(m); if (ink) outline(m,.024); return m;
  }
  const box = (x,y,z,w,h,d,m=mat.wood,parent=root,ink=true) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent,ink);
  const cyl = (x,y,z,rt,rb,h,m=mat.stone,parent=root,n=16,ink=true) => mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,parent,ink);
  function ball(x,y,z,sx,sy,sz,m,parent=root,ink=true) {
    const v=mesh(new THREE.SphereGeometry(1,16,10),m,x,y,z,parent,ink);v.scale.set(sx,sy,sz);return v;
  }
  function groupAt(x,z) { const g=new THREE.Group(); g.position.set(x,heightAt(x,z),z);root.add(g);return g; }
  function label(text,x,y,z,width=4.3,parent=root) {
    const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');
    c.fillStyle='#34323f';c.fillRect(0,0,512,128);c.strokeStyle='#d9b87b';c.lineWidth=5;c.strokeRect(7,7,498,114);
    c.fillStyle='#fff0cd';c.font='500 34px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,66,475);
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
    const board=new THREE.Group();board.position.set(x,y,z);parent.add(board);
    box(0,0,0,width,width/4,.045,mat.wood,board,false);
    const material=new THREE.MeshBasicMaterial({map:tex});
    mesh(new THREE.PlaneGeometry(width,width/4),material,0,0,.025,board,false);
    const back=mesh(new THREE.PlaneGeometry(width,width/4),material,0,0,-.025,board,false);back.rotation.y=Math.PI;
    return board;
  }

  // A single continuous terrain, including the original smooth Monopteros mound.
  const groundGeo=new THREE.PlaneGeometry(126,122,126,122);groundGeo.rotateX(-Math.PI/2);groundGeo.translate(96,0,0);
  const pos=groundGeo.attributes.position, colors=[]; const color=new THREE.Color();
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,terrainHeight(x,z));
    const patch=.94+.07*Math.sin(x*.19+Math.sin(z*.1))*Math.cos(z*.18);
    color.setRGB(patch,patch,patch);colors.push(color.r,color.g,color.b);
  }
  groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeo.computeVertexNormals();
  const terrain=mesh(groundGeo,mat.grass,0,0,0,root,false);terrain.name='park-continuous-terrain';terrain.castShadow=false;

  function ribbon(name, from, to, center, width, y, material) {
    const vertices=[];
    for(let x=from;x<to;x+=.5) {
      const xx=Math.min(to,x+.5);
      const p=(a,side)=>{const z=center(a)+side*width(a)/2;return [a,typeof y==='function'?y(a,z):y,z];};
      const a=p(x,-1),b=p(x,1),c=p(xx,-1),d=p(xx,1);vertices.push(...a,...b,...c,...b,...d,...c);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
    const r=mesh(geo,material,0,0,0,root,false);r.name=name;r.castShadow=false;return r;
  }
  ribbon('stream-banks',STREAM.from,STREAM.to,streamCenter,x=>streamWidth(x)+1.3,.045,mat.bank);
  ribbon('toon-stream',STREAM.from,STREAM.to,streamCenter,streamWidth,STREAM.waterY,mat.water);
  ribbon('water-middle-band',STREAM.from,STREAM.to,x=>streamCenter(x)-.38,x=>streamWidth(x)*.46,STREAM.waterY+.006,new THREE.MeshBasicMaterial({color:0x67bdc0}));
  ribbon('water-edge-band',STREAM.from,STREAM.to,x=>streamCenter(x)+streamWidth(x)*.32,x=>streamWidth(x)*.16,STREAM.waterY+.012,new THREE.MeshBasicMaterial({color:0x8ad2cb}));
  ribbon('riverside-walk',51,140,x=>streamCenter(x)-5.7,()=>2.3,(x,z)=>terrainHeight(x,z)+.025,mat.path);
  // Small branching trails lead to the pagoda, across the bridge and up to the hill.
  function trail(points,width=2.1) {
    const verts=[];
    for(let n=0;n<points.length-1;n++) {
      const a=points[n],b=points[n+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(length/.5);
      const dx=-(b[1]-a[1])/length*width/2,dz=(b[0]-a[0])/length*width/2;
      const p=(t,side)=>{const x=a[0]+(b[0]-a[0])*t+dx*side,z=a[1]+(b[1]-a[1])*t+dz*side;return [x,heightAt(x,z)+.028,z];};
      for(let i=0;i<steps;i++) verts.push(...p(i/steps,-1),...p(i/steps,1),...p((i+1)/steps,-1),...p(i/steps,1),...p((i+1)/steps,1),...p((i+1)/steps,-1));
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();mesh(geo,mat.path,0,0,0,root,false).castShadow=false;
  }
  trail([[101,1.5],[101,15],[108,23],[115,25]],2.8);
  trail([[96,1],[100,-8],[105,-12],[113,-17]],1.8);
  trail([[75,1],[75,16],[68,19],[61,15]],2);

  for(const b of BRIDGES) {
    const g=new THREE.Group();g.position.set(b.x,0,b.z);root.add(g);g.name=`bridge-${b.x}`;
    box(0,b.deckY-.12,0,4.5,.24,9.6,mat.wood,g);
    for(let z=-4.6;z<=4.6;z+=.42)box(0,b.deckY+.012,z,4.45,.035,.37,mat.woodLight,g,false);
    for(const side of [-1,1]) {
      box(side*2.25,1.55,0,.12,.15,9.6,mat.wood,g);
      for(let z=-4.65;z<4.8;z+=2.3)box(side*2.25,.97,z,.17,1.4,.17,mat.wood,g);
      // Ramp matches heightAt, avoiding a floating deck or an invisible step.
      const z=side*5.55;const ramp=box(0,.23,z,4.45,.10,1.64,mat.woodLight,g,false);ramp.rotation.x=side*.29;
    }
  }

  // Classical round temple, open between all ten colliding columns.
  const temple=groupAt(TEMPLE.x,TEMPLE.z);temple.name='monopteros';
  cyl(0,-.13,0,5.2,5.5,.26,mat.trim,temple,48);
  cyl(0,-.025,0,4.9,5.1,.07,mat.stone,temple,48);
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5,x=Math.cos(a)*3.6,z=Math.sin(a)*3.6;
    cyl(x,.14,z,.43,.48,.28,mat.trim,temple);
    cyl(x,2.4,z,.25,.32,4.45,mat.stone,temple,18);
    cyl(x,4.62,z,.44,.34,.24,mat.trim,temple);
    box(x,4.82,z,.85,.18,.85,mat.stone,temple);
  }
  for(const [y,r,h,m] of [[4.98,4.65,.22,mat.trim],[5.2,4.85,.22,mat.stone],[5.38,4.65,.14,mat.trim]])cyl(0,y,0,r,r,h,m,temple,48);
  const dome=mesh(new THREE.SphereGeometry(4.6,40,16,0,Math.PI*2,0,Math.PI/2),mat.copper,0,5.43,0,temple);dome.scale.y=.43;
  for(let i=0;i<16;i++) {
    const pts=[];const a=i/16*Math.PI*2;
    for(let j=0;j<=18;j++){const theta=j/18*Math.PI/2,r=4.63*Math.sin(theta);pts.push(new THREE.Vector3(r*Math.cos(a),5.43+2.0*Math.cos(theta),r*Math.sin(a)));}
    const rib=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),18,.025,4,false),mat.trim);temple.add(rib);
  }
  cyl(0,7.49,0,.09,.2,.35,mat.trim,temple);ball(0,7.71,0,.14,.14,.14,mat.trim,temple);

  // Five flared wooden roofs, a familiar silhouette rather than a surveyed replica.
  const tower=groupAt(TOWER.x,TOWER.z);tower.name='chinese-tower';
  cyl(0,.15,0,4.1,4.2,.3,mat.trim,tower,8);
  for(let level=0;level<5;level++) {
    const radius=3.9-level*.55,y=.4+level*2.2;
    cyl(0,y+.9,0,radius*.52,radius*.55,1.8,mat.wood,tower,8);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;cyl(Math.sin(a)*radius*.66,y+.9,Math.cos(a)*radius*.66,.075,.09,1.85,mat.woodLight,tower,6);
    }
    cyl(0,y+1.9,0,radius*.32,radius,.85,mat.copper,tower,8);
    cyl(0,y+1.49,0,radius*1.04,radius*1.04,.12,mat.iron,tower,8);
  }
  cyl(0,11.67,0,.03,.18,.9,mat.trim,tower,8);

  function bench(x,z,angle=0) {
    const g=groupAt(x,z);g.rotation.y=angle;
    for(const dx of [-.95,.95]){box(dx,.37,0,.12,.74,.65,mat.iron,g);box(dx,1.05,.31,.1,1,.1,mat.iron,g);}
    for(let j=0;j<3;j++){box(0,.76,-.22+j*.22,2.5,.11,.17,mat.woodLight,g);box(0,1.02+j*.19,.33,2.5,.14,.1,mat.woodLight,g);}
    return g;
  }
  bench(98,-3,Math.PI);bench(69,-3,Math.PI);bench(125,1,Math.PI);bench(77,22,.6);

  // Beer garden terrace, communal tables, mugs and strings of warm lanterns.
  const beer=groupAt(117,27);beer.name='beer-garden';
  const terrace=cyl(0,-.04,0,12.1,12.1,.06,mat.path,beer,40,false);terrace.castShadow=false;
  for(let i=0;i<8;i++) {
    const x=(i%4-1.5)*5,z=Math.floor(i/4)*5-2;
    box(x,.95,z,3.5,.16,1.15,mat.woodLight,beer);
    for(const dz of [-1.08,1.08])box(x,.53,z+dz,3.6,.14,.4,mat.wood,beer);
    for(const dx of [-1.25,1.25]){box(x+dx,.46,z,.13,.92,.75,mat.iron,beer);for(const dz of [-1.08,1.08])box(x+dx,.23,z+dz,.1,.5,.3,mat.iron,beer);}
    for(const dx of [-.8,.6]){cyl(x+dx,1.17,z,.12,.12,.28,mat.cream,beer,10);cyl(x+dx,1.32,z,.13,.13,.035,mat.stone,beer,10,false);}
  }
  for(const x of [-9,9])for(const z of [-5,7])cyl(x,2.8,z,.12,.15,5.6,mat.wood,beer);
  const lanterns=[];
  for(const z of [-5,7]) {
    const pts=[];for(let n=0;n<=20;n++)pts.push(new THREE.Vector3(-9+n*.9,5.6-.9*Math.sin(n/20*Math.PI),z));
    beer.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.023,4,false),mat.iron));
    for(let j=0;j<9;j++){const x=-8+j*2,y=5.6-.9*Math.sin((x+9)/18*Math.PI);const g=new THREE.Group();g.position.set(x,y-.32,z);beer.add(g);ball(0,0,0,.23,.32,.23,mat.glow,g);cyl(0,.3,0,.15,.15,.07,mat.wood,g,8);lanterns.push(g);}
  }
  label('BIERGARTEN  ·  慢慢坐',0,2.5,-6,5.5,beer);

  // Picnic cloths use an independent rug index (legacy L10 selected only one color).
  const blanketColors=[0xe3a3ad,0x9ab6ce,0xe9c77e,0xb4a4cf];
  [[80,-15],[90,-25],[101,-30],[78,-24],[88,-13],[122,-31],[69,-19],[131,-20]].forEach(([x,z],i)=>{
    const g=groupAt(x,z);g.rotation.y=i*.74;
    box(0,.03,0,2.8,.035,2, toon(blanketColors[i%blanketColors.length],3),g,false);
    for(const dx of [-1,0,1])box(dx,.053,0,.1,.012,1.95,mat.cream,g,false);
    box(.6,.3,.3,.6,.48,.45,mat.woodLight,g);ball(-.45,.14,-.3,.22,.1,.16,mat.cream,g,false);
  });

  // Instanced trunks and faceted crowns retain silhouette outlines in two draw calls.
  const dummy=new THREE.Object3D(), tint=new THREE.Color();
  const trunkGeo=new THREE.CylinderGeometry(.19,.36,1,7);
  const trunks=new THREE.InstancedMesh(trunkGeo,mat.trunk,TREES.length);trunks.castShadow=trunks.receiveShadow=true;root.add(trunks);
  const crownGeo=new THREE.IcosahedronGeometry(1,1);
  const crowns=new THREE.InstancedMesh(crownGeo,mat.green,TREES.length*3);crowns.castShadow=crowns.receiveShadow=true;root.add(crowns);
  const inkMat=new THREE.ShaderMaterial({side:THREE.BackSide,
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position+normal*.015,1.);}',
    fragmentShader:'void main(){gl_FragColor=vec4(.10,.13,.17,1.);}'});
  const crownInk=new THREE.InstancedMesh(crownGeo,inkMat,TREES.length*3);root.add(crownInk);
  TREES.forEach((t,i)=>{
    const y=terrainHeight(t.x,t.z);dummy.position.set(t.x,y+t.h*.45,t.z);dummy.scale.set(1,t.h*.9,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<3;j++) {
      dummy.position.set(t.x+(j===1?1:j===2?-1:0)*t.size*.5,y+t.h+(j===0?.3:-.3),t.z+(j-1)*t.size*.24);
      dummy.scale.set(t.size*(j===0?1:.78),t.size*(j===0?1.05:.8),t.size*(j===0?.88:.76));dummy.rotation.set(0,i*.8+j,.08);dummy.updateMatrix();
      const n=i*3+j;crowns.setMatrixAt(n,dummy.matrix);crownInk.setMatrixAt(n,dummy.matrix);
      tint.set(t.pink?[0xf5b6c6,0xee9bb7,0xffced0][j]:[0x6d9f6c,0x96ba75,0x5d9169][(i+j)%3]);crowns.setColorAt(n,tint);
    }
  });

  // Reeds, flowers and clumps are lightweight instances, not texture downloads.
  const flowerGeo=new THREE.IcosahedronGeometry(1,0),flowerMat=toon(0xffffff,3);
  const flowers=new THREE.InstancedMesh(flowerGeo,flowerMat,1800);root.add(flowers);
  for(let i=0;i<1800;i++) {
    const x=50+(i*13.713%94),z=-43+(i*7.391%88),s=.045+(i%4)*.018;
    dummy.position.set(x,heightAt(x,z)+.12,z);dummy.rotation.set(0,i,0);dummy.scale.set(s,s*.6,s);
    if(isNearWater(x,z)||blocked(x,z))dummy.scale.setScalar(0);
    dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);tint.set([0xf9edcb,0xf1b8cb,0xc4c9f1,0xeccd74][i%4]);flowers.setColorAt(i,tint);
  }
  function isNearWater(x,z){return Math.abs(z-streamCenter(x))<streamWidth(x)/2+.3;}
  const reeds=new THREE.InstancedMesh(new THREE.ConeGeometry(.05,.7,4),toon(0x82975e,3),360);root.add(reeds);
  for(let i=0;i<360;i++) {
    const x=48+(i*.281%98),side=i%2?1:-1,z=streamCenter(x)+side*(streamWidth(x)/2+.55+(i%3)*.16);
    dummy.position.set(x,.3,z);dummy.rotation.set(0,i,.13*side);dummy.scale.setScalar(BRIDGES.some(b=>Math.abs(x-b.x)<3)?0:.7+(i%5)*.13);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
  }

  // Stream movement: visible ripples, standing wave crests and swimming ducks.
  const ripples=new THREE.InstancedMesh(new THREE.PlaneGeometry(.62,.035),new THREE.MeshBasicMaterial({color:0xc5efe3,transparent:true,opacity:.65,depthWrite:false}),160);root.add(ripples);
  const waves=[];
  for(let i=0;i<5;i++) {
    const x=59+i*.7,points=[];
    for(let j=0;j<20;j++)points.push(new THREE.Vector3(x+.12*Math.sin(j*.8),STREAM.waterY+.12,streamCenter(x)-1.7+j*.18));
    const w=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.06,5,false),mat.cream);root.add(w);waves.push(w);
  }
  const ducks=[];
  for(let i=0;i<7;i++) {
    const g=new THREE.Group();root.add(g);ducks.push(g);
    ball(0,.16,0,.19,.15,.32,mat.cream,g);ball(0,.35,-.21,.11,.13,.11,i%3?mat.cream:toon(0x3b765f),g);
    box(0,.32,-.35,.08,.055,.15,mat.woodLight,g);ball(-.075,.39,-.26,.016,.016,.018,mat.iron,g,false);ball(.075,.39,-.26,.016,.016,.018,mat.iron,g,false);
  }

  // Distant Munich landmarks sit west of the park (legacy skyline reoriented).
  const city=new THREE.Group();city.name='munich-silhouette';city.position.set(16,-.2,0);city.rotation.y=Math.PI/2;root.add(city);
  const cityStone=toon(0x9ca0b0),cityRoof=toon(0x6e7b91),church=toon(0xc5b2a0),theatine=toon(0xd6be8f);
  for(let i=0;i<23;i++) {const x=-70+i*6,h=6+(i*7%6);box(x,h/2,0,5.8,h,8,cityStone,city,false);cyl(x,h+1,0,0,4,2,cityRoof,city,4,false);}
  box(-13,7,-4,16,14,10,church,city);
  for(const x of [-19,-7]){box(x,14,-4,4.2,28,4.2,church,city);cyl(x,28.5,-4,2.3,2.3,.5,mat.trim,city,16,false);ball(x,30.1,-4,2.3,2.4,2.3,cityRoof,city);for(const y of [19,23,26])box(x,y,-1.88,1,1.7,.06,mat.iron,city,false);}
  box(21,6,-5,15,12,10,theatine,city);ball(21,14,-5,4.5,4,4.5,cityRoof,city);
  for(const x of [14,28]){box(x,10,-3,3.4,20,3.4,theatine,city);cyl(x,21,-3,1,2.2,3,mat.trim,city,8);ball(x,22.5,-3,1.2,1.6,1.2,cityRoof,city);}

  // Trail plaques face the riverside route; no surveyed-map claims.
  for(const s of SIGHTS) {
    const y=heightAt(s.x,s.z);cyl(s.x,y+.8,s.z-1.7,.07,.09,1.6,mat.wood);
    const l=label(s.short,s.x,y+1.7,s.z-1.7,2.5);l.rotation.y=-Math.PI/2;
  }
  const entry=groupAt(64,-9);label('ENGLISCHER GARTEN',0,3,0,6.5,entry).rotation.y=-Math.PI/2;
  for(const z of [-2.8,2.8])cyl(0,1.45,z,.1,.12,2.9,mat.wood,entry);

  // The shared chapter needs only these simple companions, not the legacy cast.
  function character(coat,hair,skirt=false) {
    const g=new THREE.Group();root.add(g);const skin=toon(0xffd9bd),coatMat=toon(coat),hairMat=toon(hair);
    for(const x of [-.17,.17]){box(x,.36,0,.21,.65,.24,mat.iron,g);box(x,.10,-.09,.24,.16,.4,mat.iron,g);}
    if(skirt)cyl(0,.79,0,.30,.43,.43,coatMat,g,10);else box(0,.83,0,.57,.48,.36,coatMat,g);
    box(0,1.17,0,.61,.49,.36,coatMat,g);ball(0,1.72,0,.34,.38,.31,skin,g);
    ball(0,1.89,.04,.36,.29,.33,hairMat,g);box(0,1.77,.27,.54,.22,.11,hairMat,g);
    for(const x of [-.12,.12])ball(x,1.72,-.29,.032,.055,.025,mat.iron,g,false);
    for(const x of [-.4,.4]){box(x,1.09,0,.19,.5,.23,coatMat,g);ball(x,.82,0,.1,.12,.1,skin,g);}
    box(0,1.4,-.11,.6,.13,.4,mat.cream,g);box(.13,1.19,-.25,.16,.39,.08,mat.cream,g);
    if(skirt){ball(-.3,1.86,0,.13,.13,.08,mat.pink,g);ball(.3,1.86,0,.13,.13,.08,mat.pink,g);}
    return g;
  }
  const avatar=character(0x667d99,0x373846),companionRoot=character(0xd4969e,0x594238,true);
  avatar.rotation.y=companionRoot.rotation.y=engine.player.yaw;
  companionRoot.position.copy(engine.player.pos).add(new THREE.Vector3(1.7,0,1.3));companionRoot.position.y=heightAt(companionRoot.position.x,companionRoot.position.z);
  const head=new THREE.Vector3();engine.companion={root:companionRoot,getPosition:()=>companionRoot.position,getHeadPosition:()=>head.copy(companionRoot.position).add(new THREE.Vector3(0,2.15,0))};
  let last=engine.player.pos.clone();

  // Petals drift at a frame-rate independent speed; fireflies fade in at dusk.
  const petals=new THREE.InstancedMesh(new THREE.PlaneGeometry(.20,.12),toon(0xffb9cf,3,{side:THREE.DoubleSide}),240);root.add(petals);
  const fireflies=new THREE.InstancedMesh(new THREE.SphereGeometry(.06,5,4),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffdf83).multiplyScalar(2.3),transparent:true,opacity:0}),100);root.add(fireflies);
  const markers=SIGHTS.map(s=>{
    const m=mesh(new THREE.OctahedronGeometry(.23),mat.glow,s.x,heightAt(s.x,s.z)+2.5,s.z,root,false);return m;
  });
  let dusk=0;
  return {
    root, avatar, companion:engine.companion, markers,
    cameraBlockers:[trunks,crowns,...temple.children.filter(m=>m.isMesh),...tower.children.filter(m=>m.isMesh)],
    setDusk(value){dusk=value;fireflies.material.opacity=dusk;},
    update(dt,et) {
      const p=engine.player.pos,dx=p.x-last.x,dz=p.z-last.z,moving=Math.hypot(dx,dz)>.002;
      avatar.position.copy(p);avatar.position.y+=moving?Math.abs(Math.sin(et*8))*.055:0;
      if(moving)avatar.rotation.y=Math.atan2(-dx,-dz);last.copy(p);
      const c=companionRoot.position,distance=Math.hypot(p.x-c.x,p.z-c.z);
      if(distance>3 && !engine.isLocked()) {
        const step=Math.min(distance-2.5,dt*(distance>8?10:5));const nx=c.x+(p.x-c.x)/distance*step,nz=c.z+(p.z-c.z)/distance*step;
        if(!blocked(nx,c.z))c.x=nx;if(!blocked(c.x,nz))c.z=nz;
        companionRoot.rotation.y=Math.atan2(c.x-p.x,c.z-p.z);
      }
      // Only a debug teleport or a changed side of the stream needs recovery.
      if(distance>18) { for(const [ox,oz] of [[1.8,1.8],[-1.8,1.8],[1.8,-1.8],[0,0]])if(!blocked(p.x+ox,p.z+oz)){c.set(p.x+ox,heightAt(p.x+ox,p.z+oz),p.z+oz);break;} }
      c.y=heightAt(c.x,c.z);
      for(let i=0;i<160;i++) {
        const x=STREAM.from+(i*.651+et*.68)%(STREAM.to-STREAM.from),lane=Math.sin(i*13.7)*.39;
        dummy.position.set(x,STREAM.waterY+.024,streamCenter(x)+lane*streamWidth(x));dummy.rotation.set(-Math.PI/2,0,.13*Math.sin(i));dummy.scale.set(1,1,1);dummy.updateMatrix();ripples.setMatrixAt(i,dummy.matrix);
      }ripples.instanceMatrix.needsUpdate=true;
      waves.forEach((w,i)=>{w.position.y=.025*Math.sin(et*3+i);});
      ducks.forEach((g,i)=>{const x=79+(i*4.1+et*.32)%29;g.position.set(x,STREAM.waterY+.015+Math.sin(et*2+i)*.012,streamCenter(x)+Math.sin(i*2)*.9);g.rotation.y=-Math.PI/2;});
      lanterns.forEach((l,i)=>l.rotation.z=Math.sin(et*.9+i)*.06);
      for(let i=0;i<240;i++) {
        const x=49+(i*7.31+et*.48)%95,z=-42+(i*13.13+et*.16)%84,y=1+(i*.719-et*.4)%12;
        dummy.position.set(x,heightAt(x,z)+(y<0?y+12:y),z);dummy.rotation.set(et*.8+i,i*.9,et*.4+i);dummy.scale.set(1,1,1);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);
      }petals.instanceMatrix.needsUpdate=true;
      if(dusk>.01)for(let i=0;i<100;i++) {
        const x=65+(i*7.17%67)+Math.sin(et+i)*.3,z=streamCenter(x)+Math.sin(i*7)*5;
        dummy.position.set(x,.8+(i*.37%2)+Math.sin(et*.8+i)*.4,z);dummy.scale.setScalar(.4+.6*Math.sin(et*2+i)**2);dummy.rotation.set(0,0,0);dummy.updateMatrix();fireflies.setMatrixAt(i,dummy.matrix);
      }fireflies.instanceMatrix.needsUpdate=true;
      markers.forEach((m,i)=>{m.position.y=heightAt(SIGHTS[i].x,SIGHTS[i].z)+2.55+Math.sin(et*1.7+i)*.13;m.rotation.y=et*.4;});
    },
  };
}
