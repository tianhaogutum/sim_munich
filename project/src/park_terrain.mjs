// Compressed landscape inspired by the supplied Monopteros meadow photograph.
export function parkHeight(x,z){
  const r=Math.hypot((x-17)/1.1,z-113);
  if(r>=20)return 0;
  if(r<=6)return 3.4;
  const t=(20-r)/14;
  return 3.4*t*t*(3-2*t);
}
