import * as THREE from 'three';
import { createAnimeCompanion } from './anime_companion.js';
import { createMaleLead } from './male_lead.js';

// Three.js shares the MapLibre WebGL context. The scene stays in a small local
// metre frame around the walker while MapLibre owns all geographic precision.
export function createCityCastLayer(map, player, motion) {
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  scene.add(new THREE.HemisphereLight(0xffffff,0x586953,2.2));
  const sunlight = new THREE.DirectionalLight(0xffe4c5,2.4);sunlight.position.set(-5,15,8);scene.add(sunlight);
  const heroine = createAnimeCompanion(THREE,scene), companion = createMaleLead(THREE,scene);
  const palette=new Map();
  for(const root of [heroine.root,heroine.dog,companion.root])root.traverse(o=>{
    if(!o.isMesh)return;const old=o.material;
    const key=old.color?.getHexString()??'ffffff';
    if(!palette.has(key))palette.set(key,new THREE.MeshToonMaterial({color:key==='252932'?0xe9aab8:old.color,side:THREE.DoubleSide}));
    o.material=palette.get(key);o.castShadow=false;o.receiveShadow=false;
  });
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.7,24),new THREE.MeshBasicMaterial({color:0x374a3d,transparent:true,opacity:.25,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;scene.add(shadow);
  heroine.root.scale.setScalar(.94);companion.root.scale.setScalar(.94);
  companion.root.position.set(1.8,0,1.9);
  const rotation=new THREE.Matrix4().makeRotationX(Math.PI/2), transform=new THREE.Matrix4(), matrix=new THREE.Matrix4();
  let renderer,last=0,phase=0,heading=0;
  const layer={id:'munich-walking-cast',type:'custom',renderingMode:'3d',
    onAdd(map,gl){renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;},
    render(gl,projection){
      const now=performance.now()/1000,dt=Math.min(.05,Math.max(0,now-last||.016));last=now;
      const anchor=maplibregl.MercatorCoordinate.fromLngLat([player.lon,player.lat],0);
      const units=anchor.meterInMercatorCoordinateUnits();
      transform.makeTranslation(anchor.x,anchor.y,anchor.z).scale(new THREE.Vector3(units,-units,units)).multiply(rotation);
      camera.projectionMatrix.copy(matrix.fromArray(projection).multiply(transform));
      const moving=motion.speed>.01;if(moving)heading=motion.heading;
      heroine.root.rotation.y=heading;companion.root.rotation.y=heading;
      phase+=dt*(moving?motion.speed*2.8:1);
      heroine.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(phase+i*Math.PI)*.4:0);
      companion.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(phase+i*Math.PI)*.34:0);
      companion.arms.forEach((l,i)=>l.rotation.x=moving?-Math.sin(phase+i*Math.PI)*.22:0);
      companion.root.position.set(Math.cos(heading)*1.5+Math.sin(heading)*1.3,0,-Math.sin(heading)*1.5+Math.cos(heading)*1.3);
      heroine.update(dt,now,()=>false);
      // The helper assumes a moving world; local scene is anchored at the player.
      heroine.root.position.set(0,0,0);
      renderer.resetState();renderer.render(scene,camera);map.triggerRepaint();
    },
    onRemove(){renderer?.dispose();for(const m of palette.values())m.dispose();scene.traverse(o=>o.geometry?.dispose?.());},
  };
  return {layer,scene,heroine,companion};
}
