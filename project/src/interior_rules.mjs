export const UPPER_FLOOR = 6;
export const MID_FLOOR = 2.4;
export const STAIR_STEPS = 24;
export function floorHeight(x, z, currentHeight = 0) {
  if (![x,z,currentHeight].every(Number.isFinite) || Math.abs(x)>11.25 || Math.abs(z)>17) return null;
  let height=0;
  if(Math.abs(x)<=7 && z<=8 && z>=1) height=Math.max(0,Math.ceil((8-z)/7*16-1e-8))*MID_FLOOR/16;
  else if(Math.abs(x)<=7 && z<1 && z>=-3) height=MID_FLOOR;
  else if(Math.abs(x)>=4 && Math.abs(x)<=7 && z<-3 && z>=-11)
    height=MID_FLOOR+Math.ceil((-3-z)/8*STAIR_STEPS-1e-8)*(UPPER_FLOOR-MID_FLOOR)/STAIR_STEPS;
  else if(currentHeight>5.7 && (z<=-11 || Math.abs(x)>=8.6)) height=UPPER_FLOOR;
  if(Math.abs(height-currentHeight)>.22) return null;
  // Statue plinth, pillars, balcony edges and the open stairwell remain solid.
  if(Math.abs(x+5.4)<1.15 && Math.abs(z+.8)<1.1) return null;
  for(const cx of [-8,8]) for(const cz of [-14,-8,-2,4,10,16])
    if(Math.hypot(x-cx,z-cz)<.72) return null;
  return height;
}
