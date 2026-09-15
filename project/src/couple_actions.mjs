// Bound to these two character instances; arbitrary NPCs cannot be targets.
export function createCoupleActions(heroine,hero,blocked){
  let active=null;
  const distance=()=>Math.hypot(hero.root.position.x-heroine.root.position.x,hero.root.position.z-heroine.root.position.z);
  function available(){return !hero.seated&&distance()<=1.5&&Math.abs(hero.root.position.y-heroine.root.position.y)<.3;}
  function reset(){
    if(!active)return;
    for(const actor of [heroine,hero]){actor.arms.forEach(a=>a.rotation.set(0,0,0));actor.root.rotation.x=0;}
    heroine.root.position.x=active.startX;heroine.root.position.z=active.startZ;
    heroine.body.position.y=0;active=null;
  }
  return {
    available,isActive:()=>!!active,cancel:reset,
    start(name){
      if(active||!['hug','kiss'].includes(name)||!available())return false;
      const a=heroine.root.position,b=hero.root.position,angle=Math.atan2(b.x-a.x,b.z-a.z);
      const separation=name==='kiss'?.43:.58;
      const x=b.x-Math.sin(angle)*separation,z=b.z-Math.cos(angle)*separation;
      for(let i=1;i<=10;i++)if(blocked(a.x+(x-a.x)*i/10,a.z+(z-a.z)*i/10))return false;
      active={name,time:0,startX:a.x,startZ:a.z,x,z};
      heroine.root.rotation.y=angle+Math.PI;hero.root.rotation.y=angle;
      return true;
    },
    update(dt,cancel){
      if(!active)return;if(cancel){reset();return;}
      active.time+=dt;const t=active.time;
      if(t>=3.4){reset();return;}
      const blend=Math.min(1,t/.65,(3.4-t)/.65),approach=Math.min(1,t/.65);
      const retreat=t>2.75?(3.4-t)/.65:1,factor=approach*retreat;
      heroine.root.position.x=active.startX+(active.x-active.startX)*factor;
      heroine.root.position.z=active.startZ+(active.z-active.startZ)*factor;
      for(const actor of [heroine,hero]){
        actor.legs.forEach(l=>l.rotation.x=0);
        actor.arms.forEach((arm,i)=>{arm.rotation.x=-1.15*blend;arm.rotation.z=(i===0?-.32:.32)*blend;});
      }
      if(active.name==='kiss'){hero.root.rotation.x=.13*blend;heroine.body.position.y=.13*blend;}
    }
  };
}
