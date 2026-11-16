// Screen-space visibility assistance. Buildings keep their original depth and
// geometry; the badge is explicitly a ground locator, never a replacement 3D actor.
// The custom layer's public render matrix projects both actors and building
// surfaces, so this also works with pitch, bearing, padding and manual cameras.
const EARTH = 40075016.68557849;
export function mercatorPoint(lon, lat, altitude = 0) {
  const phi = lat * Math.PI / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2, altitude / (EARTH * Math.cos(phi))];
}
export function projectMercator(matrix, point, width, height) {
  const [x,y,z] = point;
  const w = matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
  if (w <= 0) return null;
  return {x:(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w*width/2+width/2,
    y:height/2-(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w*height/2,
    z:(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])/w};
}
function inside(point, ring) {
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export function triangleDepth(p,a,b,c) {
  const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(d)<1e-9)return null;
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/d;
  const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/d;
  if(u<0||v<0||u+v>1)return null;
  return u*a.z+v*b.z+(1-u-v)*c.z;
}
function planeDepth(p,ring) {
  const a=ring[0];
  for(let i=1;i<ring.length-1;i++){
    const b=ring[i],c=ring[i+1],d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(d)<1e-9)continue;
    const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/d;
    const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/d;
    return u*a.z+v*b.z+(1-u-v)*c.z;
  }
  return null;
}
function buildingOccludes(sample, rings, top, bottom) {
  const upper=rings.map(r=>r.map(p=>top(p))),lower=rings.map(r=>r.map(p=>bottom(p)));
  if(upper.some(r=>r.some(p=>!p))||lower.some(r=>r.some(p=>!p)))return false;
  // Roof holes remain holes. NDC depth is affine on projected planar surfaces.
  if(inside(sample,upper[0])&&!upper.slice(1).some(r=>inside(sample,r))){
    const z=planeDepth(sample,upper[0]);
    if(z!==null&&z<sample.z-1e-8)return true;
  }
  for(let r=0;r<upper.length;r++)for(let i=1;i<upper[r].length;i++){
    const a=lower[r][i-1],b=lower[r][i],c=upper[r][i],d=upper[r][i-1];
    for(const z of [triangleDepth(sample,a,b,c),triangleDepth(sample,a,c,d)])if(z!==null&&z<sample.z-1e-8)return true;
  }
  return false;
}

export function createCityVisibility({map,cast,player}) {
  const container=map.getContainer(),badge=document.createElement('div');
  badge.className='ci-player-visibility';badge.hidden=true;
  badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');
  Object.assign(badge.style,{position:'absolute',zIndex:'4',pointerEvents:'none',transform:'translate(-50%, -100%)',color:'#243e36',font:'600 12px/1.4 system-ui',textAlign:'center',whiteSpace:'nowrap'});
  badge.innerHTML='<div style="padding:7px 11px;border-radius:14px;background:rgba(255,250,230,.97);border:1px solid #b68b4f;box-shadow:0 3px 14px #273b4933"><span data-visibility-text></span><div data-visibility-hint style="font-size:10px;font-weight:400;opacity:.85">拖动或旋转地图查看人物 · F 跟随</div></div><div style="height:30px;width:0;border-left:2px dashed #ad7031;margin:auto"></div><div style="width:24px;height:12px;border:2px dashed #a75c20;border-radius:50%;background:#fff1bcaa;transform:translateY(50%);margin:auto"></div>';
  container.append(badge);
  const label=badge.querySelector('[data-visibility-text]'),hint=badge.querySelector('[data-visibility-hint]');
  let matrix=null,lastCheck=-Infinity,disposed=false,state={occluded:false,hiddenActors:[],reason:'waiting',samples:0};
  const originalRender=cast.layer.render;
  const wrappedRender=function(gl,projection){
    originalRender.call(this,gl,projection);
    matrix=projection;
    update();
  };
  cast.layer.render=wrappedRender;
  function update(force=false) {
    if(disposed||!matrix)return state;
    const now=performance.now();if(!force&&now-lastCheck<160)return state;lastCheck=now;
    const canvas=map.getCanvas(),width=canvas.clientWidth,height=canvas.clientHeight;
    const anchor=mercatorPoint(player.lon,player.lat),units=1/(EARTH*Math.cos(player.lat*Math.PI/180));
    const projectLocal=(x,y,z)=>projectMercator(matrix,[anchor[0]+x*units,anchor[1]+z*units,anchor[2]+y*units],width,height);
    const ground=projectLocal(0,0,0);
    if(!ground||ground.x<0||ground.y<0||ground.x>width||ground.y>height){badge.hidden=true;state={occluded:false,hiddenActors:[],reason:'offscreen',samples:0};return state;}
    const actors=[['女主角',cast.heroine.root,[.65,1.5]],['男伴',cast.companion.root,[.65,1.5]],['狗狗',cast.heroine.dog,[.35,.75]]];
    const samples=actors.flatMap(([name,root,heights])=>heights.map(y=>({name,point:projectLocal(root.position.x,root.position.y+y,root.position.z)}))).filter(s=>s.point);
    const hidden=new Set();
    const layerId='building-3d';
    if(map.getLayer(layerId)&&map.getZoom()>=17){
      // Loaded source geometry also includes roofs whose ground footprints
      // fall outside the viewport. Rendered query is a compatible fallback.
      const layer=map.getLayer(layerId);
      const features=typeof map.querySourceFeatures==='function'
        ? map.querySourceFeatures(layer.source,{sourceLayer:layer.sourceLayer??layer['source-layer']})
        : map.queryRenderedFeatures(undefined,{layers:[layerId]});
      for(const f of features){
        const geometry=f.geometry;if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))continue;
        const roof=Number(f.properties?.render_height??12),base=Number(f.properties?.render_min_height??0);
        if(!Number.isFinite(roof)||!Number.isFinite(base)||roof<=base)continue;
        const top=p=>projectMercator(matrix,mercatorPoint(p[0],p[1],roof),width,height);
        const bottom=p=>projectMercator(matrix,mercatorPoint(p[0],p[1],base),width,height);
        for(const rings of geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates){
          if(!rings[0]?.length)continue;
          for(const sample of samples)if(!hidden.has(sample.name)&&buildingOccludes(sample.point,rings,top,bottom))hidden.add(sample.name);
        }
      }
    }
    const distant=map.getZoom()<17;
    state={occluded:hidden.size>0,hiddenActors:[...hidden],reason:hidden.size?'building':distant?'distant':'visible',samples:samples.length};
    // Keep a small honest ground locator even in a clear view. This covers
    // partial mesh occlusion between our body samples and GPU depth quirks.
    badge.hidden=false;hint.hidden=!state.occluded&&!distant;
    if(!badge.hidden){
      badge.style.left=`${ground.x}px`;badge.style.top=`${ground.y-8}px`;
      const text=state.occluded?`${[...hidden].join('、')}被建筑遮挡 · 位置标记`:distant?'同行者位置 · 放大查看人物':'同行者地面位置';
      if(label.textContent!==text)label.textContent=text;
    }
    return state;
  }
  return {update,getState:()=>({...state,hiddenActors:[...state.hiddenActors]}),dispose(){
    disposed=true;badge.remove();if(cast.layer.render===wrappedRender)cast.layer.render=originalRender;
  }};
}
