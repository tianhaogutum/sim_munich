import { GLTFLoader } from './vendor/GLTFLoader.js';
import { Water } from './vendor/Water.js';
// Riverbank detail shares the playable river's profile and keeps bridge approaches clear.
export async function addGardenDetail(THREE, scene, sun) {
  let seed=419;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const riverX=z=>-8+2.1*Math.sin((z-75)*Math.PI/26);
  const width=z=>4.4+.5*Math.sin(z*.19);
  const matrix=new THREE.Object3D(),color=new THREE.Color();
  function instances(geometry,count,base,place){
    const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:base,roughness:.94}),count);
    for(let i=0;i<count;i++){matrix.rotation.set(0,0,0);matrix.scale.set(1,1,1);place(i,matrix);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);color.setHSL(.17+random()*.07,.18+random()*.24,.22+random()*.18);mesh.setColorAt(i,color);}
    mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  function bank(i){
    let z=59+random()*62;
    while(Math.abs(z-75)<3.4||Math.abs(z-101)<3.4)z=59+random()*62;
    const side=i%2?1:-1;return {z,side,x:riverX(z)+side*(width(z)/2+.3+random()*.55)};
  }
  instances(new THREE.IcosahedronGeometry(1,1),480,'#b7b5a1',(i,t)=>{
    const {x,z}=bank(i);t.position.set(x,.23,z);t.scale.set(.22+random()*.32,.14+random()*.22,.24+random()*.3);t.rotation.set(random()*.3,random()*6,random()*.2);
  });
  instances(new THREE.ConeGeometry(.055,.65,4),7000,'#afbd77',(i,t)=>{
    const {x,z,side}=bank(i);t.position.set(x+side*(.25+random()*1.4),.34,z);t.scale.set(.7+random(),.4+random(),.7+random());t.rotation.set(random()*.2,random()*6,(random()-.5)*.5);
  });
  const flowers=instances(new THREE.SphereGeometry(1,5,3),600,'#ffffff',(i,t)=>{
    const {x,z,side}=bank(i);t.position.set(x+side*(.6+random()*1.1),.32+random()*.35,z);if(Math.sin(z*1.1)<-.3)t.scale.setScalar(.01);t.scale.set(.065,.06,.065);
  });
  for(let i=0;i<600;i++){color.set(['#e0d7b6','#b5aecb','#c88986','#d8c47f'][i%4]);flowers.setColorAt(i,color);}
  instances(new THREE.SphereGeometry(1,6,4),220,'#718244',(i,t)=>{
    const {x,z,side}=bank(i);t.position.set(x+side*.15,.19,z);t.scale.set(.18+random()*.25,.06,.2+random()*.35);
  });
  const water=scene.getObjectByName('garden-stream');
  const normalSize=128, pixels=new Uint8Array(normalSize*normalSize*4);
  for(let y=0;y<normalSize;y++)for(let x=0;x<normalSize;x++){
    const offset=(y*normalSize+x)*4;
    const a=x/normalSize*Math.PI*2,b=y/normalSize*Math.PI*2;
    pixels[offset]=128+Math.round(7*Math.sin(a*7+b*3)+3*Math.cos(b*13));
    pixels[offset+1]=128+Math.round(6*Math.cos(b*8+a*2));pixels[offset+2]=254;pixels[offset+3]=255;
  }
  const normalMap=new THREE.DataTexture(pixels,normalSize,normalSize);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;normalMap.needsUpdate=true;
  // Water's mirror plane is local XY: convert the existing curved XZ ribbon first.
  const surfaceGeometry=water.geometry.clone();surfaceGeometry.translate(0,-.185,0);surfaceGeometry.rotateX(Math.PI/2);
  const reflectiveWater=new Water(surfaceGeometry,{textureWidth:1024,textureHeight:1024,waterNormals:normalMap,sunDirection:new THREE.Vector3(-28,17,20).normalize(),sunColor:0xffd8a0,waterColor:0x293c22,distortionScale:.65,fog:true});
  reflectiveWater.rotation.x=-Math.PI/2;reflectiveWater.position.y=.185;reflectiveWater.name='reflective-garden-stream';
  reflectiveWater.material.uniforms.size.value=65;
  water.visible=false;scene.add(reflectiveWater);
  const loader=new THREE.TextureLoader();
  const [diffuse,normal,roughness]=await Promise.all(['Diffuse','nor_gl','Rough'].map(name=>loader.loadAsync('./assets/forest_floor/'+name+'.jpg')));
  for(const map of [diffuse,normal,roughness]){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;}
  diffuse.colorSpace=THREE.SRGBColorSpace;
  const path=scene.getObjectByName('riverside-path');
  path.material=new THREE.MeshStandardMaterial({map:diffuse,normalMap:normal,roughnessMap:roughness,normalScale:new THREE.Vector2(.6,.6),roughness:1});
  const fernAsset=await new GLTFLoader().loadAsync('./assets/fern_02/fern.gltf');
  const alpha=await loader.loadAsync('./assets/fern_02/alpha.png');alpha.flipY=false;
  fernAsset.scene.updateMatrixWorld(true);
  const fernMeshes=[];fernAsset.scene.traverse(mesh=>{if(mesh.isMesh)fernMeshes.push(mesh);});
  for(const source of fernMeshes){
    const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);
    const bounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    const center=bounds.getCenter(new THREE.Vector3());geometry.translate(-center.x,-bounds.min.y,-center.z);
    const material=source.material.clone();material.alphaMap=alpha;material.alphaTest=.45;material.transparent=false;material.side=THREE.DoubleSide;
    const plants=new THREE.InstancedMesh(geometry,material,35);
    for(let i=0;i<35;i++){
      const point=bank(i),scale=.7+random()*.7;
      matrix.position.set(point.x+point.side*(.8+random()*.6),.12,point.z);
      matrix.rotation.set(0,random()*Math.PI*2,0);matrix.scale.setScalar(scale);matrix.updateMatrix();plants.setMatrixAt(i,matrix.matrix);
    }
    plants.castShadow=plants.receiveShadow=true;scene.add(plants);
  }
  // Small broken highlights travel with the flow; no reflection of off-screen objects is implied.
  const glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(.12,.018),new THREE.MeshBasicMaterial({color:'#f3e8bb',transparent:true,opacity:.36,depthWrite:false}),260);
  const starts=Array.from({length:260},()=>({z:random()*63,lane:(random()-.5)*.85}));scene.add(glints);
  return time=>{
    reflectiveWater.material.uniforms.time.value=time*.35;
    reflectiveWater.material.uniforms.sunDirection.value.copy(sun.position).sub(sun.target.position).normalize();
    reflectiveWater.material.uniforms.sunColor.value.copy(sun.color).multiplyScalar(Math.min(1,sun.intensity/3.5));
    starts.forEach((s,i)=>{const z=59+(s.z+time*.65)%63;matrix.position.set(riverX(z)+s.lane*width(z),.209,z);matrix.rotation.set(-Math.PI/2,0,Math.sin(time+i)*.25);matrix.scale.set(.5+Math.sin(time*1.7+i)**2*1.5,1,1);matrix.updateMatrix();glints.setMatrixAt(i,matrix.matrix);});
    glints.instanceMatrix.needsUpdate=true;
  };
}
