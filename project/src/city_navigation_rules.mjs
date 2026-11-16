// Geographic guidance only: no street network or turn-by-turn route is implied.
const RAD=Math.PI/180;
export const ARRIVAL_RADIUS_METERS=35;
// Older destinations retain their caller's default; new destinations declare
// a bounded radius that is shared by discovery and the navigation HUD.
export function placeArrivalRadius(place,fallback=ARRIVAL_RADIUS_METERS){
 return Number.isFinite(place?.arrivalRadius)&&place.arrivalRadius>=5&&place.arrivalRadius<=65?place.arrivalRadius:fallback;
}
export function validPosition(p){return !!p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90;}
export function normalizeHeading(degrees){return Number.isFinite(degrees)?((degrees%360)+360)%360:0;}
export function navigationDistance(a,b){
 if(!validPosition(a)||!validPosition(b))return Infinity;
 const dlat=(b.lat-a.lat)*RAD,dlon=(b.lon-a.lon)*RAD;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dlon/2)**2;
 return 12742000*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function navigationBearing(a,b){
 if(!validPosition(a)||!validPosition(b)||navigationDistance(a,b)<.01)return null;
 const dlon=(b.lon-a.lon)*RAD,lat1=a.lat*RAD,lat2=b.lat*RAD;
 return normalizeHeading(Math.atan2(Math.sin(dlon)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dlon))/RAD);
}
export function relativeBearing(target,camera){return ((normalizeHeading(target)-normalizeHeading(camera)+540)%360)-180;}
export function compassLabel(bearing){return ['北 N','东北 NE','东 E','东南 SE','南 S','西南 SW','西 W','西北 NW'][Math.round(normalizeHeading(bearing)/45)%8];}
export function hasArrived(distance,radius=ARRIVAL_RADIUS_METERS){return Number.isFinite(distance)&&distance>=0&&Number.isFinite(radius)&&radius>=0&&distance<=radius;}
export function formatNavigationDistance(distance){return !Number.isFinite(distance)?'—':distance<1000?`${Math.round(Math.max(0,distance))} m`:`${(distance/1000).toFixed(2)} km`;}
export function navigationSnapshot(position,destination,cameraBearing=0){
 const distance=navigationDistance(position,destination),bearing=navigationBearing(position,destination);
 const radius=placeArrivalRadius(destination);
 return {distance,bearing,radius,relative:bearing===null?0:relativeBearing(bearing,cameraBearing),arrived:hasArrived(distance,radius)};
}
// Keep bounded, sampled traces. Teleports start a new trace instead of inventing a walked segment.
export function recordBreadcrumb(points,position,{spacing=8,maxJump=100,limit=256}={}){
 if(!validPosition(position))return points;
 const last=points.at(-1),point={lon:position.lon,lat:position.lat};
 if(!last)return [point];
 const distance=navigationDistance(last,point);
 if(distance>maxJump)return [point];
 if(distance<spacing)return points;
 return [...points,point].slice(-Math.max(2,limit));
}
