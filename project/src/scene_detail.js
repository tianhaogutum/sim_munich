// Local procedural materials and instanced foliage: no additional network assets.
export function addSceneDetail(THREE, scene, trees, renderer) {
  let seed = 831;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = kind === 'grass' ? '#889c63' : kind === 'stone' ? '#c3bbae' : '#b4a58d';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 24000; i++) {
      const light = 70 + Math.floor(random() * 140);
      ctx.fillStyle = `rgba(${light},${light},${light},${.08 + random() * .22})`;
      const x = random() * 256, y = random() * 256;
      ctx.fillRect(x, y, kind === 'grass' ? 1 : 1 + random() * 3, kind === 'grass' ? 2 + random() * 6 : 1 + random() * 3);
    }
    if (kind === 'stone') {
      ctx.strokeStyle = '#766f6260'; ctx.lineWidth = 2;
      for (let row = 0; row < 8; row++) {
        ctx.beginPath(); ctx.moveTo(0, row * 32); ctx.lineTo(256, row * 32); ctx.stroke();
        for (let col = -1; col < 5; col++) { const x = col * 64 + (row % 2) * 32; ctx.beginPath(); ctx.moveTo(x, row * 32); ctx.lineTo(x, row * 32 + 32); ctx.stroke(); }
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const maps = { grass: texture('grass'), gravel: texture('gravel'), stone: texture('stone') };
  const grassColors = new Set(['81975a','89a665','92a678','7e9956','a5ad81']);
  const stoneColors = new Set(['e8ddc4','eae0c9','e0d0ae']);
  scene.traverse(object => {
    if (!object.isMesh || !object.material?.color) return;
    const color = object.material.color.getHexString();
    const kind = grassColors.has(color) ? 'grass' : color === 'c3b797' ? 'gravel' : stoneColors.has(color) ? 'stone' : null;
    if (!kind) return;
    const mat = object.material.clone(), map = maps[kind].clone();
    const size = object.geometry.parameters || {};
    map.repeat.set(Math.max(1, (size.width || 6) / 2), Math.max(1, (size.depth || size.height || 6) / 2));
    // Ribbon vertices use world-space UVs to keep gravel scale consistent along curves.
    if (!object.geometry.attributes.uv) {
      const pos = object.geometry.attributes.position, uv = [];
      for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) / 2, pos.getZ(i) / 2);
      object.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); map.repeat.set(1, 1);
    }
    mat.map = map; mat.bumpMap = map; mat.bumpScale = kind === 'stone' ? .045 : .022;
    mat.roughness = .96; object.material = mat;
  });
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=64;
  const leafCtx=leafCanvas.getContext('2d');
  leafCtx.fillStyle='#ffffff';leafCtx.beginPath();leafCtx.moveTo(32,2);leafCtx.bezierCurveTo(62,20,58,44,32,62);leafCtx.bezierCurveTo(6,44,2,20,32,2);leafCtx.fill();
  const leafMap=new THREE.CanvasTexture(leafCanvas);
  const leafGeometry = new THREE.PlaneGeometry(1, 1);
  const transform = new THREE.Object3D(), tint = new THREE.Color();
  trees.forEach((crown, index) => {
    crown.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(crown);
    const center = bounds.getCenter(new THREE.Vector3()).sub(crown.position);
    const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, alphaMap: leafMap, alphaTest:.5, side:THREE.DoubleSide });
    const leaves = new THREE.InstancedMesh(leafGeometry, material, 2400);
    const clusters=Array.from({length:9},(_,j)=>{
      const angle=j*2.4+index*.7,r=.35+random()*.55;
      return new THREE.Vector3(center.x+Math.cos(angle)*size.x*r,center.y+(random()-.35)*size.y,center.z+Math.sin(angle)*size.z*r);
    });
    for (let i = 0; i < 2400; i++) {
      const theta = random() * Math.PI * 2, vertical = random() * 2 - 1;
      const radius = Math.sqrt(1 - vertical * vertical), r = .55 + random() * .5;
      const cluster=clusters[i%clusters.length];
      transform.position.set(cluster.x + Math.cos(theta)*radius*size.x*.48*r, cluster.y+vertical*size.y*.48*r, cluster.z+Math.sin(theta)*radius*size.z*.48*r);
      transform.rotation.set(random() * 3, random() * 6, random() * 3);
      transform.scale.set(.22 + random() * .25, .30 + random() * .25, 1);
      transform.updateMatrix(); leaves.setMatrixAt(i, transform.matrix);
      tint.setHSL(.20 + random() * .07, .30 + random() * .25, .16 + random() * .16);
      leaves.setColorAt(i, tint);
    }
    // Replace the original solid blobs with a porous leaf canopy.
    crown.children.forEach(child => { child.visible = false; });
    leaves.castShadow = leaves.receiveShadow = true; crown.add(leaves);
    const bark=new THREE.MeshStandardMaterial({color:'#635643',roughness:1});
    const trunkTop=new THREE.Vector3(0,-.6,0),up=new THREE.Vector3(0,1,0);
    for(const cluster of clusters){
      const direction=cluster.clone().sub(trunkTop),length=direction.length();
      const branch=new THREE.Mesh(new THREE.CylinderGeometry(.035,.12,length,7),bark);
      branch.position.copy(trunkTop).add(cluster).multiplyScalar(.5);
      branch.quaternion.setFromUnitVectors(up,direction.normalize());branch.castShadow=true;crown.add(branch);
    }

  });
  // Dense but inexpensive grass clumps around park trees, clear of paths and bridges.
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(.045, .38, 3), new THREE.MeshStandardMaterial({ color: '#71844b', roughness: 1 }), 4500);
  for (let i = 0; i < 4500; i++) {
    const tree = trees[6 + i % (trees.length - 6)];
    const angle = random() * Math.PI * 2, radius = 1 + random() * 2.5;
    transform.position.set(tree.position.x + Math.cos(angle) * radius, .22, tree.position.z + Math.sin(angle) * radius);
    transform.rotation.set(0, random() * 6, (random() - .5) * .4);
    transform.scale.set(1, .5 + random(), 1); transform.updateMatrix(); blades.setMatrixAt(i, transform.matrix);
  }
  blades.receiveShadow = true; scene.add(blades);
  // Layered flowering borders: stems, low foliage, then small petal clusters.
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 3), new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9}), 1800);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.014,.022,1,4), new THREE.MeshStandardMaterial({color:'#536937',roughness:1}), 300);
  for(let i=0;i<300;i++) {
    const side=i%2?1:-1, x=side*(9.5+random()*5), z=(i%4<2?10:21)+(random()-.5)*3.6;
    const h=.5+random()*.75;
    transform.position.set(x,.48+h/2,z);transform.rotation.set(0,0,(random()-.5)*.12);transform.scale.set(1,h,1);transform.updateMatrix();stems.setMatrixAt(i,transform.matrix);
    tint.set(['#eee3c5','#a396ba','#d9a6b8','#e4bd81'][i%4]);
    for(let j=0;j<6;j++) {
      const angle=j/6*Math.PI*2;
      transform.position.set(x+Math.cos(angle)*.09,.48+h+(j%2)*.05,z+Math.sin(angle)*.09);
      transform.scale.set(.085,.065,.085);transform.updateMatrix();flowers.setMatrixAt(i*6+j,transform.matrix);flowers.setColorAt(i*6+j,tint);
    }
  }
  flowers.castShadow=flowers.receiveShadow=true;stems.castShadow=true;scene.add(flowers,stems);

}
