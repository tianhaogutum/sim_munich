// Reach between the two low bridges: stop before either bridge, never pass through it.
export const driftX=z=>-8+2.1*Math.sin((z-75)*Math.PI/26);
export function driftStep(z,dt,paused){return Math.min(97,Math.max(79,z+(paused?0:Math.min(dt,.05)*1.2)));}
export function createRiverDrift({THREE,scene,player,canStart,toast,setView}){
  const raft=new THREE.Group();raft.name='river-drift-raft';scene.add(raft);
  const wood=new THREE.MeshStandardMaterial({color:'#98724c',roughness:.85});
  for(let i=0;i<5;i++){
    const log=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,2.2,10),wood);
    log.rotation.x=Math.PI/2;log.position.set((i-2)*.25,.16,0);log.castShadow=log.receiveShadow=true;raft.add(log);
  }
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.1,.12,.35),wood);seat.position.set(0,.42,.45);raft.add(seat);
  let active=false,z=79;
  const button=document.createElement('button');button.textContent='小溪漂流';document.querySelector('.tools').append(button);
  function leave(){active=false;player.root.position.set(driftX(z)+3.5,.12,z);player.body.position.y=0;player.legs.forEach(p=>p.rotation.x=0);button.textContent='小溪漂流';toast('已靠岸，回到河边');}
  button.onclick=()=>{
    if(active){leave();return;}
    if(!canStart()){toast('请先结束互动或下车');return;}
    z=79;player.root.position.set(driftX(z),.46,z);active=true;button.textContent='漂流靠岸';setView();toast('沿溪漂流 · 按空格暂停 · 到桥前自动停下 · 点击漂流靠岸');
  };
  function update(dt,time,keys){
    if(active&&Math.hypot(player.root.position.x-driftX(z),player.root.position.z-z)>8){active=false;player.body.position.y=0;button.textContent='小溪漂流';}
    if(active){z=driftStep(z,dt,keys.has('Space'));player.root.position.set(driftX(z),.46+Math.sin(time*1.5)*.015,z);player.root.rotation.y=Math.PI;player.body.position.y=-.2;player.legs.forEach(p=>p.rotation.x=-Math.PI/2);if(z===97)button.textContent='已到桥前 · 靠岸';}
    if(active&&player.dog){player.dog.position.set(driftX(z)+3.5,.12,z);}
    raft.position.set(driftX(z),.12+Math.sin(time*1.5)*.015,z);raft.rotation.y=Math.atan2(driftX(z+.1)-driftX(z),.1);
  }
  return {update,isActive:()=>active};
}
