// Game-scale bicycle steering model; these are tuning values, not AMG specifications.
export const CAR_HALF_WIDTH=.96;
export const CAR_HALF_LENGTH=2.32;
export function carFootprint(x,z,heading) {
  const points=[];
  for(const lateral of [-CAR_HALF_WIDTH,0,CAR_HALF_WIDTH])for(const longitudinal of [-CAR_HALF_LENGTH,-1.16,0,1.16,CAR_HALF_LENGTH])
    points.push([x+Math.cos(heading)*lateral+Math.sin(heading)*longitudinal,z-Math.sin(heading)*lateral+Math.cos(heading)*longitudinal]);
  return points;
}
export function stepCar(state,input,dt,canOccupy) {
  let next={...state};const steps=Math.max(1,Math.ceil(Math.min(dt,.1)/.016));const h=Math.min(dt,.1)/steps;
  for(let i=0;i<steps;i++) {
    const throttle=Number(!!input.forward)-Number(!!input.reverse);
    const opposing=throttle*next.speed<0;
    const acceleration=input.brake?-Math.sign(next.speed)*12:opposing?throttle*9:throttle*4;
    const before=next.speed;next.speed+=acceleration*h;
    if(input.brake && before*next.speed<0)next.speed=0;
    if(!throttle&&!input.brake)next.speed*=Math.exp(-1.2*h);
    next.speed=Math.max(-3,Math.min(13,next.speed));
    if(Math.abs(next.speed)<.015)next.speed=0;
    const steering=(Number(!!input.left)-Number(!!input.right))*.5/(1+Math.abs(next.speed)*.055);
    next.steer=steering;
    const angle=next.heading+next.speed/2.65*Math.tan(steering)*h;
    const x=next.x-Math.sin(angle)*next.speed*h,z=next.z-Math.cos(angle)*next.speed*h;
    if(canOccupy(x,z,angle)){next.x=x;next.z=z;next.heading=angle;}else{next.speed=0;next.hit=true;break;}
  }
  return next;
}
