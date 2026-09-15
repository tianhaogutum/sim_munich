import { parkHeight } from './park_terrain.mjs';

// Photo-inspired distant silhouettes, not a surveyed city reconstruction.
export function addParkViews({THREE,scene,box,cylinder,ball,person}){
  const skyline=new THREE.Group();skyline.name='distant-city-silhouette';scene.add(skyline);
  const stone='#adae9d',roof='#6b827c';
  for(let i=0;i<15;i++){
    const x=-46+i*6,y=8+(i*7%5);
    box(x,y/2,-37,5.8,y,5,stone,skyline);
    const top=cylinder(x,y+.6,-37,0,4,.9,roof,skyline,4);top.rotation.y=Math.PI/4;
  }
  for(const x of [9,13]){
    box(x,11,-39,2.7,22,2.7,'#bbb5a0',skyline);
    cylinder(x,22.1,-39,1.4,1.4,.45,'#d1c6aa',skyline);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(1.45,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:roof,roughness:.85}));dome.position.set(x,22.3,-39);dome.scale.y=1.25;skyline.add(dome);
    for(const y of [13,16,19])box(x,y,-37.63,.65,1.1,.04,'#536464',skyline);
  }
  for(const [x,height]of[[-21,23],[30,19],[-39,17]]){
    box(x,height/2,-40,1.6,height,1.6,stone,skyline);cylinder(x,height+2,-40,0,1.05,4,roof,skyline,8);
  }
  let seed=872;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#b1aa8d',roughness:1}),1800);
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  for(let i=0;i<1800;i++){
    const z=83+random()*14,x=-8+2.1*Math.sin((z-75)*Math.PI/26),half=(4.4+.5*Math.sin(z*.19))/2;
    const side=i%2?1:-1;dummy.position.set(x+side*(half+.12+random()*.65),.17,z);
    dummy.scale.set(.04+random()*.07,.025+random()*.035,.04+random()*.07);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    color.setHSL(.1,.08+random()*.12,.35+random()*.3);mesh.setColorAt(i,color);
  }
  mesh.receiveShadow=true;scene.add(mesh);
  for(let i=0;i<5;i++){
    const z=86+i*1.5,x=-8+2.1*Math.sin((z-75)*Math.PI/26)+2.8;
    const duck=new THREE.Group();duck.position.set(x,.2,z);duck.rotation.y=i*1.2;scene.add(duck);
    ball(0,.16,0,.19,.17,.32,'#eee9d7',duck);ball(0,.36,-.21,.095,.12,.095,'#f3eedf',duck);
    box(0,.34,-.32,.075,.05,.13,'#bb8951',duck);
  }
  // Scattered visitors and rugs leave the meadow's broad center open.
  for(let i=0;i<8;i++){
    const x=4+(i%3)*10,z=85+Math.floor(i/3)*5;
    if(i%2===0)box(x,.115+parkHeight(x,z),z,1.8,.018,1.3,['#9fafa6','#ac9388'][i%2]);
    const guest=person(['#aab8b7','#c4aa8c','#a499aa'][i%3]);guest.root.position.set(x,.12+parkHeight(x,z),z);guest.root.rotation.y=i;
    if(i%2===0){guest.body.position.y=-.4;guest.legs.forEach(leg=>leg.rotation.x=-1.2);}
  }
}
