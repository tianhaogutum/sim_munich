// North-up schematic in the same coordinates as the playable scene.
// World +X = north; +Z = east. Distances intentionally follow the compressed game.
export function mapPoint(x, z, width, height) {
  const scale=Math.min((width-32)/154,(height-32)/240);
  return {x:width/2+(z-61)*scale,y:height/2-x*scale,scale};
}

export function addNeighborhoodMap({player,footprints}) {
  const host=document.querySelector('.mini');
  const oldImage=host?.querySelector('img');
  if(!host || !oldImage)return;
  const style=document.createElement('style');
  style.textContent=`
    .mini.neighborhood-map{padding:10px;right:18px;bottom:18px;width:176px}
    .neighborhood-map canvas{width:100%;height:90px;border-radius:7px;background:#e7e2cf}
    .neighborhood-map button{width:100%;padding:5px 8px;margin-bottom:7px;font-size:12px}
    .neighborhood-map:not(.expanded) .map-caption{display:none}
    .neighborhood-map .map-caption{font-size:10px;color:#dedcc4;margin:6px 0;line-height:1.4}
    .mini.neighborhood-map.expanded{width:min(410px,90vw);z-index:7}
    .neighborhood-map.expanded canvas{height:min(480px,65vh)}
    @media(max-width:700px){.mini.neighborhood-map{display:block;width:115px;bottom:18px;right:12px}.neighborhood-map:not(.expanded) canvas,.neighborhood-map:not(.expanded) .map-caption,.neighborhood-map:not(.expanded) #compass{display:none}.neighborhood-map button{margin:0}.neighborhood-map.expanded button{margin-bottom:7px}}
  `;
  document.head.append(style);
  const button=document.createElement('button');button.type='button';button.textContent='展开街区地图';button.setAttribute('aria-expanded','false');
  const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','街区地图，北朝上，金色箭头表示你的位置');
  const caption=document.createElement('p');caption.className='map-caption';caption.textContent='北朝上 · 金色箭头是你\n游戏街区示意，非等比例实景';
  oldImage.replaceWith(button,canvas,caption);host.classList.add('neighborhood-map');
  let expanded=false;
  button.onclick=()=>{expanded=!expanded;host.classList.toggle('expanded',expanded);button.textContent=expanded?'收起街区地图':'展开街区地图';button.setAttribute('aria-expanded',String(expanded));draw();};
  button.addEventListener('keydown',event=>event.stopPropagation());
  const ctx=canvas.getContext('2d');
  const landmarks=[['凯旋门',96,31],['LMU',0,-9],['大学站',0,28],['教堂',-62,42],['州立图书馆',-96,48],['圆亭',17,88],['中国塔',-25,115]];
  function draw() {
    const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    const width=bounds.width,height=bounds.height,dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#e7e2cf';ctx.fillRect(0,0,width,height);
    const point=(x,z)=>{
      if(expanded)return mapPoint(x,z,width,height);
      const scale=Math.min(width,height)/75,pos=player.root.position;
      return {x:width/2+(z-pos.z)*scale,y:height/2-(x-pos.x)*scale,scale};
    };
    function rect(x,z,w,d,color){const p=point(x+w/2,z-d/2);ctx.fillStyle=color;ctx.fillRect(p.x,p.y,d*p.scale,w*p.scale);}
    function line(points,color,size){ctx.beginPath();points.forEach(([x,z],i)=>{const p=point(x,z);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineJoin='round';ctx.stroke();}
    const scale=point(0,0).scale;
    rect(0,96,92,76,'#b7c799');
    rect(0,8,48,35,'#d4c9ad');
    line([[-112,31],[112,31]],'#faf6e8',13*scale);
    line([[-112,31],[112,31]],'#a4a497',8*scale);
    for(const x of [-39,42])line([[x,21],[x,57]],'#faf6e8',5*scale);
    line([[0,18],[0,61],[4,76],[17,88]],'#f1ead2',3*scale);
    const river=[];for(let z=58;z<=123;z+=2)river.push([-8+2.1*Math.sin((z-75)*Math.PI/26),z]);
    line(river,'#6d9fa0',4*scale);
    for(const z of [75,101])line([[-12.5,z],[-3.5,z]],'#967b56',3*scale);
    for(const {x,z,w,d} of footprints)rect(x,z,w,d,'#af9c80');
    rect(0,-12.5,46,6,'#9c896b');rect(27,-1.5,7,30,'#9c896b');rect(-27,-8,7,17,'#9c896b');
    ctx.font=`${expanded?12:9}px system-ui`;ctx.textAlign='left';ctx.textBaseline='middle';
    for(const [name,x,z] of landmarks){if(!expanded && ['大学站','州立图书馆','圆亭'].includes(name))continue;const p=point(x,z);ctx.fillStyle='#4b6254';ctx.beginPath();ctx.arc(p.x,p.y,expanded?3:2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#34473e';ctx.textAlign=p.x>width-65?'right':'left';ctx.fillText(name,p.x+(p.x>width-65?-5:5),p.y-5);ctx.textAlign='left';}
    if(expanded){const p=point(57,84);ctx.fillStyle='#526a43';ctx.fillText('英国公园',p.x,p.y);const road=point(66,27);ctx.save();ctx.translate(road.x,road.y);ctx.rotate(-Math.PI/2);ctx.fillStyle='#666b60';ctx.fillText('Ludwigstraße',0,0);ctx.restore();}
    const pos=player.root.position,p=point(pos.x,pos.z),angle=player.root.rotation.y||0;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-angle-Math.PI/2);ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fillStyle='#ebae42';ctx.fill();ctx.strokeStyle='#624b23';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    ctx.fillStyle='#34473e';ctx.font='bold 11px system-ui';ctx.fillText('N ↑',width-30,13);
  }
  // A map needs only five updates per second; no second WebGL scene or network tiles.
  let last=0;
  function frame(now){if(!host.isConnected)return;if(now-last>=200){if(!document.hidden)draw();last=now;}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}
