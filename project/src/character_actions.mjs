export function actionPose(name,time){
  const duration={wave:2.4,jump:1.1,spin:2.2}[name];
  if(!duration||time>=duration)return null;
  const t=Math.max(0,time)/duration,envelope=Math.sin(Math.PI*t);
  return {name,lift:name==='jump'?Math.sin(Math.PI*t)*.7:0,turn:name==='spin'?Math.PI*2*t:0,
    arm:name==='wave'?envelope*(2.2+Math.sin(time*15)*.22):name==='jump'?envelope*.8:envelope*1.2};
}
export function createCharacterActions(player){
  let current=null;
  function reset(){player.body.rotation.y=0;player.body.position.y=0;player.arms[0].rotation.z=0;current=null;}
  return {
    start(name){reset();if(actionPose(name,0))current={name,time:0};},
    update(dt,cancel){
      if(!current)return;
      if(cancel){reset();return;}
      current.time+=dt;const pose=actionPose(current.name,current.time);
      if(!pose){reset();return;}
      player.body.position.y=pose.lift;player.body.rotation.y=pose.turn;
      player.arms[0].rotation.z=-pose.arm;player.arms[0].rotation.x=0;
    }
  };
}
