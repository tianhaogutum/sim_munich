import * as THREE from 'three';
import { UPPER_FLOOR, MID_FLOOR, STAIR_STEPS } from './interior_rules.mjs';

// Photo-based proportions, not a surveyed architectural model.
export function buildStairHall(scene) {
  const stone='#b5b5a8', trim='#e4dfca', wall='#b5b29a', gold='#a79050', dark='#343c36';
  const materials=new Map();
  function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.76}));return materials.get(color);}
  function mesh(g,color,x,y,z){const m=new THREE.Mesh(g,mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m;}
  function box(x,y,z,w,h,d,c=stone){return mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z);}
  function rod(a,b,r=.045,c=gold){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);const m=mesh(new THREE.CylinderGeometry(r,r,from.distanceTo(to),8),c,...from.clone().add(to).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return m;}
  function arch(x,y,z,r=1.7,thick=.28,rotation=0){const s=new THREE.Shape();s.absarc(0,0,r+thick,0,Math.PI,false);s.absarc(0,0,r,Math.PI,0,true);s.closePath();const m=mesh(new THREE.ExtrudeGeometry(s,{depth:.4,bevelEnabled:false,curveSegments:32}),trim,x,y,z);m.rotation.y=rotation;return m;}
  function ellipsoid(x,y,z,a,b,c,color){const m=mesh(new THREE.SphereGeometry(1,16,12),color,x,y,z);m.scale.set(a,b,c);return m;}
  // Repeated stone slabs in one draw call.
  box(0,-.18,0,24,.3,36);
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.99,.025,.99),mat('#b5b5aa'),864);
  const t=new THREE.Object3D();let n=0;
  for(let x=-11.5;x<12;x++)for(let z=-17.5;z<18;z++){t.position.set(x,0,z);t.updateMatrix();tiles.setMatrixAt(n,t.matrix);tiles.setColorAt(n++,new THREE.Color().setHSL(.13,.055,.59+((x*17+z*31+2000)%7)*.006));}
  tiles.receiveShadow=true;scene.add(tiles);
  for(const x of [-12,12]){box(x,8,0,.4,16,36,wall);for(const y of [.35,6,11.4,12])box(x*.98,y,0,.55,.18,36,trim);}
  box(0,8,-18,24,16,.4,wall);box(0,8,18,24,16,.4,wall);
  // Broad foreground staircase and intermediate platform.
  for(let i=1;i<=16;i++){
    const h=i*MID_FLOOR/16,z=8-(i-.5)*7/16;
    box(0,h/2,z,14,h,7/16,'#979b94');box(0,h+.006,z+.2,14,.025,.05,'#d0d0c4');
  }
  box(0,MID_FLOOR/2,-1,14,MID_FLOOR,4);
  // Stone frame and gilded scrolling infill, aligned to the slope.
  function balustrade(a,b){
    rod([a[0],a[1]+1.05,a[2]],[b[0],b[1]+1.05,b[2]],.12,stone);
    rod([a[0],a[1]+.12,a[2]],[b[0],b[1]+.12,b[2]],.09,stone);
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]), count=Math.ceil(length/1.15);
    const point=(t,h=0)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+h,a[2]+(b[2]-a[2])*t];
    for(let i=0;i<=count;i++)rod(point(i/count),point(i/count,1.12),.075,stone);
    for(let i=0;i<count;i++){
      const lo=(i+.1)/count,hi=(i+.9)/count;
      rod(point(lo,.22),point(hi,.9),.024);rod(point(lo,.9),point(hi,.22),.024);
      for(const offset of [-.18,.18]){
        const pts=[];for(let j=0;j<=28;j++){const angle=j/28*Math.PI*2;pts.push(new THREE.Vector3(...point((i+.5+Math.cos(angle)*.22)/count,.57+offset+Math.sin(angle)*.14)));}
        const scroll=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),28,.023,5,false),mat(gold));scene.add(scroll);
      }
    }
  }
  for(const side of [-1,1]){
    for(let i=1;i<=STAIR_STEPS;i++){
      const h=MID_FLOOR+i*(UPPER_FLOOR-MID_FLOOR)/STAIR_STEPS,z=-3-(i-.5)*8/STAIR_STEPS;
      box(side*5.5,h/2,z,3,h,8/STAIR_STEPS,'#979b94');box(side*5.5,h+.006,z+.14,3,.025,.045,'#d0d0c4');
    }
    for(const x of [side*3.9,side*7.1])balustrade([x,MID_FLOOR,-3],[x,UPPER_FLOOR,-11]);
    // Side galleries and upper parapets.
    box(side*10,5.85,0,4,.3,36);
    balustrade([side*8,UPPER_FLOOR,-11],[side*8,UPPER_FLOOR,17]);
    balustrade([side*7.1,0,8],[side*7.1,MID_FLOOR,1]);
  }
  box(0,5.85,-14.5,24,.3,7);
  balustrade([-3.85,UPPER_FLOOR,-10.8],[3.85,UPPER_FLOOR,-10.8]);
  // Recessed arch below the upper platform, with a lit inner doorway.
  for(const x of [-2.95,2.95])box(x,2.65,-11.2,1.8,5.3,.65);
  arch(0,3.5,-10.95,2.05,.4);box(0,5.75,-11.2,8,.45,.65);
  box(0,2.2,-17.65,2.8,4.4,.1,'#716c54');
  for(const x of [-1.5,1.5])box(x,2.2,-17.4,.13,4.4,.2,trim);
  const glow=new THREE.PointLight(0xffedc9,45,12);glow.position.set(0,3,-15);scene.add(glow);
  // Three tall rear arcade openings, seen beneath the organ gallery.
  for(const x of [-6,0,6]){
    for(const cx of [x-2.15,x+2.15]){
      mesh(new THREE.CylinderGeometry(.28,.34,3.6,20),trim,cx,7.8,-14);
      box(cx,9.7,-14,.85,.32,.85,trim);
    }
    arch(x,9.8,-13.85,1.85,.35);
    for(const z of [-15.5,-17])arch(x,9.8,z,1.85,.2);
    const light=new THREE.PointLight(0xfff0d0,24,9);light.position.set(x,9,-16);scene.add(light);
  }
  for(const x of [-9,-3,3,9])box(x,8.9,-14.35,1.55,5.8,.55,wall);
  box(0,11.95,-14.35,21,.4,.55,wall);
  // Light stone columns and tall side arches, instead of green double colonnades.
  for(const x of [-8,8])for(const z of [-14,-8,-2,4,10,16]){
    mesh(new THREE.CylinderGeometry(.34,.42,4.6,24),trim,x,8.5,z);
    box(x,6.1,z,.95,.22,.95);box(x,10.9,z,1,.34,1,trim);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipsoid(x+Math.cos(a)*.4,10.65,z+Math.sin(a)*.4,.12,.23,.12,trim);}
  }
  for(const x of [-8,8])for(const z of [-11,-5,1,7,13])arch(x,11.05,z,2.65,.25,Math.PI/2);
  // Barrel vault and polygonal coffer ribs from the supplied reference.
  const vaultMat=new THREE.MeshStandardMaterial({color:trim,roughness:.92,side:THREE.DoubleSide});
  const vertices=[],uvs=[],indices=[];
  for(let j=0;j<=1;j++)for(let i=0;i<=64;i++){
    const a=i/64*Math.PI;
    vertices.push(12*Math.cos(a),12+5.5*Math.sin(a),j?18:-18);uvs.push(i/64,j);
  }
  for(let i=0;i<64;i++){indices.push(i,i+1,i+65,i+1,i+66,i+65);}
  const vaultGeometry=new THREE.BufferGeometry();vaultGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));vaultGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));vaultGeometry.setIndex(indices);vaultGeometry.computeVertexNormals();
  const vault=new THREE.Mesh(vaultGeometry,vaultMat);vault.receiveShadow=true;scene.add(vault);
  // Explicit surface points prevent ornament from floating away from the vault.
  for(let z=-16;z<=16;z+=2.6)for(let j=1;j<12;j++){
    const a=j*Math.PI/12,points=[];
    for(let k=0;k<=8;k++){const q=k*Math.PI/4,angle=a+Math.cos(q)*.095;points.push(new THREE.Vector3(11.9*Math.cos(angle),12+5.45*Math.sin(angle),z+Math.sin(q)*1.05));}
    const path=new THREE.CurvePath();for(let k=0;k<points.length-1;k++)path.add(new THREE.LineCurve3(points[k],points[k+1]));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(path,32,.04,5,false),mat('#c7c2ad')));
  }
  // Organ facade: tall central pipes and lower rising side ranks.
  box(0,12.1,-15,15,.5,1.2,trim);box(0,14.25,-15.65,14.6,4.2,.35,'#656657');
  for(let i=-36;i<=36;i++){
    const x=i*.19,ax=Math.abs(x);
    const h=ax<2?4.55-ax*.5:2.3+(ax-2)*.23;
    mesh(new THREE.CylinderGeometry(.068,.068,h,10),'#737f73',x,12.5+h/2,-15.05);
    for(const y of [12.85,13.15])mesh(new THREE.CylinderGeometry(.083,.083,.06,10),'#bec3ae',x,y,-15.05);
    box(x,12.65,-14.97,.075,.19,.025,'#26332e');
  }
  for(const y of [11.8,12.1,12.35])box(0,y,-14.85,15.4,.14,1.3,trim);
  // A simplified seated stone figure and veined marble plinth at the left landing.
  const sx=-5.4,sz=-.8,marble='#cad2ca';
  box(sx,3.75,sz,1.9,2.7,1.65,'#727e78');box(sx,5.15,sz,2.15,.2,1.9,marble);
  box(sx,5.65,sz-.3,1.4,.9,1.1,marble); // seat
  ellipsoid(sx,6.3,sz-.1,.58,.85,.4,marble);
  ellipsoid(sx,7.2,sz-.08,.31,.4,.31,marble);
  ellipsoid(sx,7.43,sz-.15,.33,.2,.28,'#b7c3b9');
  ellipsoid(sx,7.16,sz+.22,.09,.15,.12,marble);
  for(const side of [-1,1]){
    rod([sx+side*.48,6.65,sz],[sx+side*.64,6.02,sz+.42],.17,marble);
    rod([sx+side*.64,6.02,sz+.42],[sx+side*.22,5.95,sz+.62],.13,marble);
    ellipsoid(sx+side*.29,5.75,sz+.55,.29,.45,.48,marble);
    rod([sx+side*.3,5.7,sz+.75],[sx+side*.3,5.23,sz+.98],.2,marble);
  }
  for(let i=-4;i<=4;i++)rod([sx+i*.115,6.6,sz+.29],[sx+i*.17,5.28,sz+.88],.033,'#b7c3b9');
  // Historic dark lantern on the upper railing.
  rod([3.5,6,-11],[3.5,7.4,-11],.11,dark);
  box(3.5,7.85,-11,.5,.75,.5,'#d1c7a0');
  for(const x of [3.22,3.78])for(const z of [-11.28,-10.72])rod([x,7.4,z],[x,8.3,z],.045,dark);
  mesh(new THREE.ConeGeometry(.47,.45,4),dark,3.5,8.45,-11);
  box(3.5,7.35,-11,.65,.15,.65,dark);
  // Diffuse side daylight; bright panels have no outdoor sightlines to fake.
  for(const side of [-1,1])for(const z of [-8,2,12]){
    const window=box(side*11.75,9,z,.08,4,2.4,'#f1efda');window.material=new THREE.MeshStandardMaterial({color:'#fff8de',emissive:'#eee7ce',emissiveIntensity:.6});
    const light=new THREE.PointLight(0xfff3d9,65,17,2);light.position.set(side*10.8,10,z);scene.add(light);
  }
  // Fixed procedural mottling and marble veins, without external texture downloads.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#c5c6bb';ctx.fillRect(0,0,256,256);
  for(let i=0;i<2400;i++){const x=i*73%256,y=i*137%256;ctx.fillStyle=`rgba(74,79,68,${.025+(i%9)*.008})`;ctx.fillRect(x,y,2+i%7,2+i%5);}
  for(let i=0;i<9;i++){ctx.beginPath();ctx.strokeStyle=i%2?'#deded0':'#919b8a';ctx.lineWidth=.7;for(let y=0;y<=256;y+=4){const x=i*33+Math.sin(y*.023+i)*19+Math.sin(y*.08+i)*5;y?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  for(const color of [stone,wall,trim,'#727e78', '#979b94']){mat(color).map=texture;mat(color).bumpMap=texture;mat(color).bumpScale=.025;}
  mat(gold).metalness=.65;mat(gold).roughness=.38;
}
