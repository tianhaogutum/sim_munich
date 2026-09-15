import { parkHeight } from './park_terrain.mjs';

export async function addMeadowDetail(THREE,scene){
  const loader=new THREE.TextureLoader();
  const textures=await Promise.all(['color','normal','roughness'].map(name=>loader.loadAsync('./assets/sparse_grass/'+name+'.jpg')));
  textures.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;});textures[0].colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({color:'#bdce93',map:textures[0],normalMap:textures[1],roughnessMap:textures[2],normalScale:new THREE.Vector2(.65,.65),roughness:1});
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float groundDetail=clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114))*2.0,0.0,1.0);
      diffuseColor.rgb=mix(vec3(.105,.17,.038),vec3(.37,.47,.13),groundDetail);
    `);
  };
  scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const p=mesh.geometry.parameters;
    if(mesh.name!=='monopteros-meadow-hill'&&!(p?.width===96&&p?.depth===110))return;
    const position=mesh.geometry.attributes.position,uv=[];
    for(let i=0;i<position.count;i++)uv.push((position.getX(i)+mesh.position.x)/3,(position.getZ(i)+mesh.position.z)/3);
    mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.material=material;
  });
  // One draw call for short grass, with roots fixed on the playable terrain.
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([-.022,0,0,.022,0,0,.014,.13,.018,-.014,.13,.018,0,.25,.06],3));
  geo.setIndex([0,1,2,0,2,3,3,2,4]);geo.computeVertexNormals();
  const wind={value:0};
  const grassMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.96,side:THREE.DoubleSide});
  grassMaterial.onBeforeCompile=shader=>{
    shader.uniforms.meadowTime=wind;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float meadowTime;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=instanceMatrix[3].x*.8+instanceMatrix[3].z*.3;
      transformed.x+=sin(meadowTime*1.1+phase)*position.y*position.y*.5;
    `);
  };
  const count=48000,grass=new THREE.InstancedMesh(geo,grassMaterial,count),dummy=new THREE.Object3D(),color=new THREE.Color();
  let seed=9841;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<count;i++){
    let x,z;
    do{x=2.5+random()*29;z=68+random()*61;}while(Math.hypot(x-17,z-113)<5.4||(x>11&&z<65));
    dummy.position.set(x,.095+parkHeight(x,z),z);dummy.rotation.set(0,random()*Math.PI*2,0);
    const scale=.18+random()*.38;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
    color.setHSL(.20+random()*.05,.35+random()*.2,.15+random()*.075);grass.setColorAt(i,color);
  }
  grass.receiveShadow=true;grass.name='meadow-short-grass';scene.add(grass);
  return time=>{wind.value=time;};
}
