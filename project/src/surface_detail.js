// Shared surface maps add small-scale variation without adding scene geometry.
export function addSurfaceDetail(THREE,scene,renderer){
  let seed=715;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  function make(kind){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle='#b8b8b8';ctx.fillRect(0,0,256,256);
    for(let i=0;i<12000;i++){
      const v=90+Math.floor(rand()*110);ctx.fillStyle=`rgb(${v},${v},${v})`;
      ctx.fillRect(rand()*256,rand()*256,kind==='stone'?1+rand()*3:1,kind==='stone'?1+rand()*3:4+rand()*18);
    }
    if(kind!=='stone')for(let i=0;i<65;i++){
      const x=rand()*256;ctx.strokeStyle=kind==='bark'?'#59595980':'#70707055';ctx.lineWidth=kind==='bark'?1.5:.6;
      ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+12,85,x-9,170,x,256);ctx.stroke();
    }
    const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return map;
  }
  const maps={bark:make('bark'),wood:make('wood'),stone:make('stone')},cache=new Map();
  const bark=new Set(['776b4e','706347','635643']);
  const wood=new Set(['a18e69','baa27b','7c7258']);
  const stone=new Set(['b7b5a1','92988a','b1aa8d']);
  scene.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.material?.color)return;
    const source=mesh.material,key=source.color.getHexString();
    const kind=bark.has(key)?'bark':wood.has(key)?'wood':stone.has(key)?'stone':null;
    if(!kind)return;
    if(!cache.has(source)){
      const material=source.clone();material.map=maps[kind];material.bumpMap=maps[kind];material.bumpScale=kind==='bark'?.075:.028;material.roughness=.94;
      cache.set(source,material);
    }
    mesh.material=cache.get(source);
  });
  // Continuous narrow ribs follow the dome instead of disconnected box segments.
  const ribMaterial=new THREE.MeshStandardMaterial({color:'#6d796b',metalness:.35,roughness:.6});
  for(let rib=0;rib<24;rib++){
    const angle=rib*Math.PI/12,points=[];
    for(let j=0;j<=32;j++){
      const t=.06+j/32*(Math.PI/2-.06),r=4.36*Math.sin(t);
      points.push(new THREE.Vector3(17+Math.cos(angle)*r,8.95+1.965*Math.cos(t),113+Math.sin(angle)*r));
    }
    const curve=new THREE.CatmullRomCurve3(points);
    const seam=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.018,5,false),ribMaterial);seam.castShadow=true;scene.add(seam);
  }

}
