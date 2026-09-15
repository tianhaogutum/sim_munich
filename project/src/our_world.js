import { parkHeight } from './park_terrain.mjs';
import { daysTogether, seasonAt, lightingAt, anniversariesToday, normalizeState, visibleWishes, allLettersFound, validateConfig, validateLetters } from './world_rules.mjs';

export async function createOurWorld(env) {
  const { THREE, scene, sun, trees, player, camera, renderer, box, cylinder, ball, bench, person, animatePerson, obstacle, obstacles, toast } = env;
  async function read(name) {
    const response = await fetch(`./data/${name}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${name}.json 加载失败 (${response.status})`);
    return response.json();
  }
  const [rawConfig, rawLetters, lines] = await Promise.all([read('world'), read('letters'), read('npc_lines')]);
  const config = validateConfig(rawConfig), letters = validateLetters(rawLetters);
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) throw new Error('npc_lines.json 需要是文本列表');
  let state, storageBroken = false;
  try { state = normalizeState(JSON.parse(localStorage.getItem('lmu-our-world-v1') || '{}')); }
  catch { state = normalizeState(); storageBroken = true; }
  function save() {
    try { localStorage.setItem('lmu-our-world-v1', JSON.stringify(state)); }
    catch { storageBroken = true; toast('浏览器无法保存，本次内容仅在当前页面保留。'); }
    updateJournal();
  }
  function node(tag, text, parent, className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; if (parent) parent.append(el); return el;
  }
  const dialog = node('dialog', undefined, document.body, 'world-dialog');
  let onClose = null, sitting = false, near = null, clockStamp = '', weatherOverride = 'sunset';
  dialog.addEventListener('close', () => { onClose?.(); onClose = null; });
  function open(title, build) {
    dialog.replaceChildren(); node('span', 'OUR LITTLE WORLD', dialog, 'world-eyebrow'); node('h2', title, dialog);
    build(dialog);
    const close = node('button', '继续散步', dialog, 'world-close'); close.type = 'button'; close.onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
  }
  function paragraph(parent, text) { return node('p', text, parent); }
  function input(parent, label, multiline = false) {
    const wrap = node('label', label, parent); const field = node(multiline ? 'textarea' : 'input', undefined, wrap);
    field.maxLength = 500; field.required = true; if (multiline) field.rows = 3; return field;
  }
  function authorSelect(parent) {
    const wrap = node('label', '这次是谁留下的？', parent), select = node('select', undefined, wrap);
    const me = node('option', '我', select); me.value = 'me'; const you = node('option', config.recipientName || '你', select); you.value = 'you'; return select;
  }
  const journal = node('button', '小世界手记', document.querySelector('.tools')); journal.id = 'world-journal';
  const count = node('p', '', document.querySelector('.quest')); count.id = 'world-count';
  const clockLabel = node('p', '', document.querySelector('.brand')); clockLabel.className = 'world-clock';
  const anniversaryMessage = node('div', '', document.body, 'world-anniversary glass interface'); anniversaryMessage.hidden = true;
  const photoFrame = node('div', undefined, document.body, 'world-photo-frame'); photoFrame.hidden = true;
  node('span', `${config.recipientName || '你'} & 我`, photoFrame); node('small', '我们的小世界', photoFrame);
  const captureControl = node('div', undefined, document.body, 'world-photo-controls'); captureControl.hidden = true;
  const shutter = node('button', '保存合影', captureControl); shutter.onclick = () => env.takePhoto();
  const exitPhoto = node('button', '退出拍照', captureControl); exitPhoto.onclick = () => env.togglePhoto();
  function updateJournal() { count.textContent = `信件 ${letters.filter(l => state.found.includes(l.id)).length}/${letters.length} · 愿望 ${state.wishes.length}`; }
  journal.onclick = () => open('小世界手记', root => {
    paragraph(root, '走近发光的小物件，按 E 或点击提示探索。沿广场后方的路牌，可以走到约会草坪和英国公园。');
    paragraph(root, `信件 ${letters.filter(l => state.found.includes(l.id)).length}/${letters.length} · 愿望 ${state.wishes.length} · 留言 ${state.notes.length}`);
    if (state.dayFound) paragraph(root, dayText());
    if (allLettersFound(letters, state.found)) paragraph(root, config.letterReward || '所有信都找齐了。解锁的话语还等你写入 letterReward。');
    for (const letter of letters.filter(l => state.found.includes(l.id))) { const details = node('details', undefined, root); node('summary', letter.title, details); paragraph(details, letter.text); }
    paragraph(root, '愿望、留言与发现进度只保存在当前浏览器；不同设备不会自动同步。');
    if (storageBroken) paragraph(root, '当前浏览器存储不可用，关闭后可能丢失本次进度。');
    const missing = [!config.startDate && '开始日期', !config.initials && '名字缩写', !config.doorPassword && '暗语'].filter(Boolean);
    if (missing.length) paragraph(root, `尚待填写：${missing.join('、')}。内容统一在 data/world.json。`);
  });
  const targets = [];
  function target(id, label, x, z, action, radius = 2.2) { const item = { id, label, x, z, action, radius }; targets.push(item); return item; }
  function plaque(text, x, y, z, w = 3.5, h = .65) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); mesh.position.set(x, y, z); scene.add(mesh);
    function write(value) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 1024, 192); ctx.fillStyle = '#ede1c2'; ctx.fillRect(0,0,1024,192); ctx.fillStyle = '#34493e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '46px system-ui'; ctx.fillText(value, 512, 98, 950); texture.needsUpdate = true; }
    write(text); mesh.userData.write = write; return mesh;
  }
  // A personal seat, with a seated pose that is restored when the story closes.
  bench(-6, 24, 0); plaque(config.bench.name, -6, 1.65, 23.55, 3.2, .45);
  target('bench', `坐在${config.bench.name}`, -6, 22.4, () => {
    const old = player.root.position.clone(); sitting = true; player.root.position.set(-6, .07, 24); player.root.rotation.y = Math.PI;
    player.body.position.y = -.25; player.legs.forEach(leg => leg.rotation.x = -Math.PI / 2);
    onClose = () => { sitting = false; player.root.position.copy(old); player.body.position.y = 0; player.legs.forEach(leg => leg.rotation.x = 0); };
    open(config.bench.name, root => paragraph(root, config.bench.text));
  });
  function dayText() { const day = daysTogether(config.startDate); return day === null ? '纪念日期还没有写下。' : `在一起第 ${day} 天`; }
  const dayPlaque = plaque(dayText(), 5, .13, -3.5, 4, .8); dayPlaque.rotation.x = -Math.PI / 2; dayPlaque.visible = state.dayFound;
  target('days', '看看这块特别的地砖', 5, -3.5, () => { state.dayFound = true; dayPlaque.visible = true; save(); open('我们的日子', root => paragraph(root, dayText())); });
  const initials = plaque(config.initials ? `${config.initials} ♥` : '等待你们的缩写 ♥', -19, 2, 13.6, 2.1, .42);
  initials.material.opacity = 0;
  target('initials', '看看树上的刻字', -19, 14, () => open('树上的秘密', root => paragraph(root, config.initials ? `${config.initials} ♥` : '在 world.json 的 initials 中填入你们的缩写。')));
  // IDs, rather than array indexes, keep discovery progress stable after edits.
  const envelopes = [];
  const defaultSpots = [[-6,-4],[19,12],[-21,21],[8,24],[-8,40],[13,53],[-22,61],[8,71]];
  letters.forEach((letter, i) => {
    const [x,z] = letter.position || defaultSpots[i % defaultSpots.length].map((v, axis) => v + (axis === 0 ? Math.floor(i / defaultSpots.length) * .65 : 0));
    const envelope = box(x, .85, z, .55, .35, .07, '#f2dfb7'); envelope.rotation.z = -.12;
    const seal = ball(x, .85, z + .065, .07, .07, .035, '#bd705d'); envelopes.push({ envelope, seal, base: .85 });
    target(letter.id, `读信 · ${letter.title}`, x, z, () => {
      if (!state.found.includes(letter.id)) state.found.push(letter.id); save();
      open(letter.title, root => { paragraph(root, letter.text); paragraph(root, `第 ${i+1} 封 / 共 ${letters.length} 封`); if (allLettersFound(letters, state.found)) paragraph(root, config.letterReward || '已找齐全部信件，解锁的话语还待写下。'); });
    }, 1.9);
  });
  // Wishes: one submitted wish is one coin, with a per-author unlock threshold.
  let coinTime = -1;
  const coin = cylinder(0, 1, 7, .12, .12, .035, '#eac76a'); coin.visible = false;
  function wishes() {
    open('许愿池', root => {
      const form = node('form', undefined, root), author = authorSelect(form);
      const text = input(form, '把愿望轻轻放进水里', true);
      node('button', '投一枚硬币，留下愿望', form).type = 'submit';
      const history = node('div', undefined, root);
      function render() {
        history.replaceChildren(); const own = state.wishes.filter(w => w.author === author.value).length;
        paragraph(history, `已投入 ${own} 枚 · 看见对方愿望需要 ${config.wishRevealCoins} 枚`);
        const visible = visibleWishes(state, author.value, config.wishRevealCoins);
        if (!visible.length) paragraph(history, '池水里还没有你能看到的愿望。');
        visible.forEach(w => paragraph(history, `${w.author === 'me' ? '我' : config.recipientName || '你'}：${w.text}`));
      }
      author.onchange = render; render();
      form.onsubmit = e => { e.preventDefault(); const value = text.value.trim(); if (!value) return text.setCustomValidity('写下一句话再投币吧。'); state.wishes.push({ author: author.value, text: value, at: new Date().toISOString() }); save(); text.value = ''; render(); coinTime = 0; toast('愿望已投入水中'); };
      text.oninput = () => text.setCustomValidity('');
    });
  }
  target('wishes', '投币许愿', 0, 8.5, wishes, 2.3);
  // Two local notes, one per author, shown as colored cards on the wall.
  box(-25.2, 1.7, 19, .3, 3.4, 5, '#c2b497'); obstacle(-25.2,19,.3,5);
  const noteBoards = ['me','you'].map((author,i) => { const p=plaque('',-24.99,1.7,18+i*2,1.55,1.25); p.rotation.y=Math.PI/2; return p; });
  function updateNotes() { noteBoards.forEach((p,i) => { const author=['me','you'][i], text=state.notes.find(n=>n.author===author)?.text; p.userData.write(text ? text.slice(0,24) : (i ? config.recipientName || '你' : '我')+'的留言'); p.material.color.set(i ? '#f4c8be' : '#f7e6a1'); }); }
  updateNotes();
  target('notes','留言墙',-23.2,19,() => open('留言墙',root=>{
    paragraph(root,'每人一张，修改会覆盖自己的上一张留言。保存在当前浏览器。');
    const form=node('form',undefined,root), author=authorSelect(form), text=input(form,'留一句话',true);
    const list=node('div',undefined,root);
    function render(){list.replaceChildren();state.notes.forEach(n=>paragraph(list,`${n.author==='me'?'我':config.recipientName||'你'}：${n.text}`));text.value=state.notes.find(n=>n.author===author.value)?.text||'';}
    author.onchange=render;render();node('button','贴到墙上',form).type='submit';
    form.onsubmit=e=>{e.preventDefault();const value=text.value.trim();if(!value)return;state.notes=state.notes.filter(n=>n.author!==author.value);state.notes.push({author:author.value,text:value});save();updateNotes();render();toast('留言已贴好');};
  }));
  const photoPosition={x:5,z:18};
  const photoRing = new THREE.Mesh(new THREE.RingGeometry(.95,1.05,48),new THREE.MeshBasicMaterial({color:'#f5d998',side:THREE.DoubleSide}));photoRing.rotation.x=-Math.PI/2;photoRing.position.set(5,.13,18);scene.add(photoRing);
  plaque('最佳合影点',5,.9,18,2.3,.4);
  target('photo','进入双人拍照',5,18,()=>env.togglePhoto(),2);
  const companion=person('#b7c7af');companion.root.visible=false;
  function nearPhoto(){return Math.hypot(player.root.position.x-photoPosition.x,player.root.position.z-photoPosition.z)<2.5;}
  function photoChanged(active){const framed=active&&nearPhoto();photoFrame.hidden=!framed;captureControl.hidden=!active;companion.root.visible=framed;if(framed){companion.root.position.copy(player.root.position).add(new THREE.Vector3(.8,0,0));companion.root.rotation.y=player.root.rotation.y;}return framed;}
  function drawFrame(ctx,w,h){if(photoFrame.hidden)return;ctx.strokeStyle='#f4e3bd';ctx.lineWidth=Math.max(3,w*.004);ctx.strokeRect(w*.055,h*.065,w*.89,h*.87);ctx.fillStyle='#f4e3bd';ctx.textAlign='center';ctx.font=`${Math.max(20,w*.024)}px Georgia`;ctx.fillText(`${config.recipientName||'你'} & 我 · 我们的小世界`,w/2,h*.89);}
  // Campus -> first-date lawn -> a stylized, continuous English Garden.
  // Landmark reference: https://www.muenchen.de/en/sights/attractions/english-garden
  const lawn=box(0,-.02,80,96,.2,110,'#81975a');
  box(0,.1,70,4,.05,87,'#c3b797');box(-12,.1,37,24,.05,3,'#c3b797');
  plaque('草坪 ←  ·  英国公园 ↑',0,2,27,5,.65);
  for(const x of [-1.8,1.8]) cylinder(x,1,27,.06,.06,2,'#746749');
  // The user's real memory is the lawn opposite the teaching building.
  box(-12,.15,36,16,.1,12,'#89a665');
  const picnic=box(-12,.23,36,2.8,.04,2,'#b79a84');
  box(-12,.27,36,.12,.04,2,'#eee0c1');box(-12,.27,36,2.8,.04,.12,'#eee0c1');
  plaque(config.firstDate.name || '第一次约会的地方',-12,1,32,5,.65);
  target('first-date','在第一次约会的草坪停一会儿',-12,34,()=>open(config.firstDate.name||'第一次约会的地方',root=>{paragraph(root,config.firstDate.description||'等待你补充这个地方的故事。');paragraph(root,'从这里回望教学楼，沿小路继续向前就是英国公园。');}),3);
  // Private garden gate: the passphrase is a story mechanic, not authentication.
  box(20,.12,55,17,.06,17,'#92a678');
  for(const [x,z,w,d] of [[11.5,55,.6,18],[28.5,55,.6,18],[20,64,17,.6],[14.7,46,6.4,.6],[25.3,46,6.4,.6]]){box(x,1.05,z,w,2.1,d,'#718356');obstacle(x,z,w,d);}
  box(18,1.8,46,.35,3.6,.4,'#d7c7a5');box(22,1.8,46,.35,3.6,.4,'#d7c7a5');box(20,3.7,46,4.4,.3,.6,'#d7c7a5');
  const gate=new THREE.Group();gate.position.set(18,0,46);scene.add(gate);box(2,1.65,0,3.8,3.3,.22,'#776d56',gate);ball(3.5,1.6,-.16,.09,.09,.09,'#cfb76e',gate);
  obstacle(20,46,4,.35);const gateCollision=obstacles.at(-1);let gateOpen=false;
  target('door','敲一敲暗语门',20,44,()=>{
    if(gateOpen)return open('门开着',root=>paragraph(root,'往里走，是我们的小花园和小屋。'));
    open('只有你知道的暗语',root=>{
      if(!config.doorPassword)return paragraph(root,'暗语还没有设置。请在 data/world.json 的 doorPassword 中填写，然后刷新。');
      const form=node('form',undefined,root),answer=input(form,'轻声说出那个词');answer.type='password';answer.maxLength=200;
      const error=node('p','',form);error.setAttribute('role','status');node('button','开门',form).type='submit';
      form.onsubmit=e=>{e.preventDefault();if(answer.value.normalize('NFKC').trim()!==config.doorPassword.normalize('NFKC').trim()){error.textContent='还不是那个词，再想一想。';return;}gateOpen=true;obstacles.splice(obstacles.indexOf(gateCollision),1);dialog.close();toast('门开了。');};
    });
  },2.5);
  // Cutaway cottage, with a real walkable doorway and two seats at the table.
  box(20,.15,57,10,.2,10,'#b9a789');
  const cottageParts=[];
  for(const [x,z,w,d] of [[15,57,.25,10],[25,57,.25,10],[17,52,4,.25],[23,52,4,.25]]){const wall=box(x,1.9,z,w,3.6,d,'#e0d0ae');cottageParts.push(wall);obstacle(x,z,w,d);}
  box(20,.65,62,10,1,.2,'#dfd0ae');box(20,3.2,62,10,.8,.2,'#dfd0ae');obstacle(20,62,10,.2);
  for(const x of [15.15,18,22,24.85])box(x,2,62,.15,2,.25,'#8a7655');
  const roof1=box(17.5,4.35,57,5.9,.22,10.5,'#a76d4d');roof1.rotation.z=.27;
  const roof2=box(22.5,4.35,57,5.9,.22,10.5,'#a76d4d');roof2.rotation.z=-.27;
  plaque('我们的小屋',20,3.4,51.8,3.3,.55).rotation.y=Math.PI;
  box(20,1.05,57,2.5,.18,1.7,'#92795b');obstacle(20,57,2.5,1.7);
  for(const x of [19,21])for(const z of [56.4,57.6])box(x,.56,z,.12,1,.12,'#92795b');
  for(const x of [17.6,22.4]){box(x,.58,57,.9,.15,.9,'#b49870');box(x,1.12,57.4,.9,1,.12,'#b49870');for(const dx of [-.33,.33])for(const dz of [-.33,.33])box(x+dx,.28,57+dz,.1,.55,.1,'#756447');}
  const homeCard=plaque('留给我们的记忆',20,1.2,56.8,1.5,.55);homeCard.rotation.x=-Math.PI/2;
  target('home','看看桌上的记忆卡片',20,54.7,()=>open('我们的小屋',root=>{if(!config.homeCards.length)paragraph(root,'桌上还没有照片故事。在 world.json 的 homeCards 中，可以放进你们的文字卡片。');config.homeCards.forEach(text=>paragraph(root,text));}),2);
  // Sample the same river shape for water, banks, decorations and collision.
  // Both bridges sit on zero crossings, keeping the established walking routes.
  function riverX(z){return -8+2.1*Math.sin((z-75)*Math.PI/26);}
  function riverWidth(z){return 4.4+.5*Math.sin(z*.19);}
  function ribbon(name,center,width,from,to,y,color){
    const vertices=[];
    for(let z=from;z<to;z+=.5){
      const next=Math.min(z+.5,to);
      const a=[center(z)-width(z)/2,y,z],b=[center(z)+width(z)/2,y,z];
      const c=[center(next)-width(next)/2,y,next],d=[center(next)+width(next)/2,y,next];
      vertices.push(...a,...c,...b,...b,...c,...d);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices),3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:name==='garden-stream'?.28:1}));
    mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  ribbon('garden-banks',riverX,z=>riverWidth(z)+1.7,58,123,.16,'#a8ad7c');
  ribbon('garden-stream',riverX,riverWidth,58,123,.185,'#588f91');
  ribbon('riverside-path',z=>riverX(z)-5.5,()=>2.4,60,122,.125,'#c3b797');
  // Short segments follow the bends; bridge corridors remain free of water barriers.
  for(let z=58.5;z<123;z+=1){
    if(Math.abs(z-75)<3||Math.abs(z-101)<3)continue;
    obstacle(riverX(z),z,riverWidth(z),1);
  }
  for(const z of [75,101]){
    box(-8,.27,z,9,.18,4.5,'#a18e69');
    for(let x=-12.3;x<-3.5;x+=.45)box(x,.375,z,.4,.035,4.5,'#baa27b');
    for(const zz of [z-2.3,z+2.3]){
      box(-8,1.15,zz,9,.13,.13,'#7c7258');
      for(const x of [-12.3,-10.2,-8,-5.8,-3.7])box(x,.78,zz,.15,1.2,.15,'#7c7258');
      obstacle(-8,zz,9,.12);
    }
    box(-18,.1,z,32,.05,3,'#c3b797');
  }
  const flowLines=Array.from({length:48},(_,i)=>{
    const line=box(0,.203,0,.035+(i%3)*.025,.008,.35+(i%4)*.15,'#b1d1c7');
    line.castShadow=false;line.visible=false;return line;
  });
  // Small bank details use a fixed pattern so reloads retain the same layout.
  for(let i=0;i<66;i++){
    const z=59+i*.94;if(Math.abs(z-75)<3.5||Math.abs(z-101)<3.5)continue;
    const side=i%2?1:-1,x=riverX(z)+side*(riverWidth(z)/2+.35);
    if(i%3===0){
      const rock=ball(x,.25,z,.35+(i%4)*.1,.22,.28,'#92988a');rock.rotation.y=i;
    }else{
      for(let j=0;j<3;j++){
        const height=.45+((i+j)%5)*.13;
        const reed=cylinder(x+j*.12,.2+height/2,z+j*.09,.018,.035,height,'#7a8953',scene,5);
        reed.rotation.z=side*.12;
        if(j===1)ball(x+j*.12,.2+height,z+j*.09,.055,.14,.055,'#87704c');
      }
    }
  }
  plaque('ENGLISCHER GARTEN',0,2.4,58,6,.65);
  target('park','英国公园',0,59,()=>open('英国公园 · Englischer Garten',root=>{paragraph(root,'草地、溪流与林间小路连接着 Monopteros 圆亭。这里是风格化的游戏地图，地标距离和布局经过压缩。');const a=node('a','参考：慕尼黑官方公园介绍',root);a.href='https://www.muenchen.de/en/sights/attractions/english-garden';a.target='_blank';a.rel='noopener';}),3);
  const pavilionStart=scene.children.length;
  cylinder(17,.86,88,4.8,5.2,.22,'#d8cfb8');
  cylinder(17,1.02,88,4.4,4.65,.2,'#e5dcc7');
  for(let i=0;i<10;i++) {const angle=i/10*Math.PI*2,x=17+Math.cos(angle)*3.6,z=88+Math.sin(angle)*3.6;cylinder(x,3.2,z,.2,.25,4.3,'#efe3c9',scene,32);cylinder(x,1.18,z,.4,.4,.16,'#d0c4a9');}
  cylinder(17,5.4,88,4.3,4.3,.4,'#dfcfac',scene,64);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(4.35,64,32,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#71867d',roughness:.65,metalness:.25}));dome.position.set(17,5.55,88);dome.scale.y=.45;scene.add(dome);
  // Layered entablature, capitals and raised copper ribs from the supplied views.
  for(const [y,r,h,c] of [[5.18,4.36,.1,'#e9dbbb'],[5.62,4.55,.12,'#f2e4c6'],[5.79,4.45,.12,'#d5c39b']])cylinder(17,y,88,r,r,h,c,scene,64);
  for(let i=0;i<10;i++){
    const angle=i*Math.PI/5,x=17+Math.cos(angle)*3.6,z=88+Math.sin(angle)*3.6;
    cylinder(x,5.13,z,.37,.28,.17,'#eadcbd');cylinder(x,1.35,z,.29,.36,.14,'#e7d9bb');
    for(const side of [-1,1])ball(x+Math.cos(angle)*side*.22,5.08,z+Math.sin(angle)*side*.22,.12,.10,.12,'#eadcbd');
  }
  cylinder(17,7.59,88,.12,.24,.15,'#c9b27e');ball(17,7.74,88,.16,.16,.16,'#d4bd87');
  for(const part of scene.children.slice(pavilionStart)){part.position.z+=25;part.position.y+=3.4;}
  // The pavilion is viewed from its base; steps remain simple collision geometry.
  obstacle(17,113,10,10);plaque('MONOPTEROS',17,3.6,104.8,3.8,.6);
  target('monopteros','抬头看圆亭',17,103,()=>open('Monopteros 圆亭',root=>paragraph(root,'走过开阔的草坪，在圆亭前停下来。回过头，还能望向来时的小路。')),3);
  // A compact five-tier pagoda silhouette marks the far end of the walk.
  for(let level=0;level<5;level++){
    const radius=3.9-level*.55,y=1+level*2;
    cylinder(-25,y+1,115,radius*.58,radius*.58,1.8,'#977957',scene,8);
    cylinder(-25,y+1.9,115,radius*.35,radius, .8,'#626e64',scene,8);
  }
  obstacle(-25,115,7,7);plaque('CHINESISCHER TURM',-25,1.3,110,5,.6);
  target('tower','林间的中国塔',-25,109,()=>open('中国塔',root=>paragraph(root,'英国公园里的另一处地标。沿溪流旁的小路，可以回到草坪和校园。')),3);
  const terrainVertices=[];
  for(let x=-6;x<40;x+=1)for(let z=93;z<134;z+=1){
    const point=(xx,zz)=>[xx,.09+parkHeight(xx,zz),zz];
    terrainVertices.push(...point(x,z),...point(x,z+1),...point(x+1,z),...point(x+1,z),...point(x,z+1),...point(x+1,z+1));
  }
  const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(terrainVertices),3));terrainGeometry.computeVertexNormals();
  const hill=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({color:'#81975a',roughness:1}));hill.name='monopteros-meadow-hill';hill.receiveShadow=true;scene.add(hill);
  // Mixed groves leave the central lawn, landmarks and bridge approaches open.
  function parkTree(x,z,index){
    const height=3.6+(index%5)*.55,spread=1.6+(index%4)*.28;
    cylinder(x,parkHeight(x,z)+height/2,z,.16,.32,height,'#776b4e',scene,8);obstacle(x,z,.65,.65);
    const crown=new THREE.Group();crown.position.set(x,parkHeight(x,z)+height-.25,z);scene.add(crown);
    const colors=['#6e894e','#819951','#587b50'];
    ball(0,.5,0,spread,spread*1.12,spread,colors[index%3],crown);
    ball(spread*.65,0,.3,spread*.7,spread*.8,spread*.7,colors[(index+1)%3],crown);
    ball(-spread*.5,.4,-.5,spread*.7,spread*.9,spread*.7,colors[index%3],crown);
    trees.push(crown);
  }
  for(let i=0;i<45;i++){
    const x=i%2===0?-40+(i%7)*1.9:34+(i%5)*2,z=34+(i*17%94);
    parkTree(x,z,i);
  }
  for(const [i,x,z] of [[0,-20,63],[1,-25,67],[2,-22,87],[3,-29,90],[4,-22,97],
    [5,-18,118],[6,-29,124],[7,30,65],[8,32,77],[9,34,88],[10,35,103],
    [11,2,120],[12,33,121],[13,6,129],[14,25,131],[15,-18,105]])parkTree(x,z,i+45);
  for(let i=0;i<18;i++)parkTree(-1+(i%9)*4.7,124+Math.floor(i/9)*6,i+70);
  // Low meadow patches soften the large flat lawn without obstructing movement.
  for(let i=0;i<90;i++){
    const x=-33+(i*13.71%64),z=62+(i*9.37%65);
    if((x>1&&x<30&&z>65)||Math.abs(x)<3||Math.abs(x-riverX(z))<7||Math.abs(z-75)<4||Math.abs(z-101)<4||
       Math.hypot(x-17,z-88)<9||Math.hypot(x+25,z-115)<7)continue;
    ball(x,.08,z,.6+(i%3)*.3,.16,.55,'#8da266');
    for(let j=0;j<3;j++){
      const flower=ball(x+j*.19,.27,z+(j%2)*.25,.075,.08,.075,['#e4d9a0','#d6bacb','#e8e4cd'][i%3]);
      flower.castShadow=false;
    }
  }
  bench(29,73,0);bench(-1,98,.3);bench(-20,80,0);
  // Small groups suggest a lived-in park while leaving the main sightline open.
  const parkWalkers=[];
  for(let i=0;i<9;i++){
    const visitor=person(['#b8b5a1','#9aafba','#c5a083'][i%3]);
    const x=i<5?3+(i%3)*2:27+(i%2)*2,z=80+i*2.2;
    visitor.root.position.set(x,.12+parkHeight(x,z),z);visitor.root.rotation.y=i;
    parkWalkers.push({visitor,x,z,phase:i*1.7});
  }
  for(const [x,z] of [[24,85],[6,94],[29,91]]){
    box(x,.14+parkHeight(x,z),z,2,.025,1.6,'#bda995');
    for(let i=0;i<2;i++){
      const guest=person(i?'#b8afca':'#c6ba98');guest.root.position.set(x+i*.75-.4,.12+parkHeight(x,z),z);
      guest.body.position.y=-.4;guest.legs.forEach(leg=>leg.rotation.x=-1.25);
    }
  }
  const friend=person('#c9ac99');friend.root.position.set(7,.12,34);let lineIndex=0;
  const friendTarget=target('friend','和散步的人聊聊',7,34,()=>open('散步的人',root=>{paragraph(root,lines.length?lines[lineIndex++%lines.length]:'台词还等你写进 data/npc_lines.json。');}),2.5);
  // Real local clock, seasonal foliage and weather. No invented anniversary dates.
  const hemisphere=scene.children.find(item=>item.isHemisphereLight);
  const nightMaterials=new Set();
  scene.traverse(object=>{if(object.isMesh && object.material?.color?.getHexString()==='3b4d4c')nightMaterials.add(object.material);});
  const lamps=[];
  for(const x of [-16,16])for(const z of [6,18]){const light=new THREE.PointLight('#ffd392',0,13,2);light.position.set(x,5,z);scene.add(light);lamps.push(light);}
  const homeLight=new THREE.PointLight('#ffd9a4',0,14,2);homeLight.position.set(20,3,57);scene.add(homeLight);lamps.push(homeLight);
  const seasonalMaterials=new Map();
  trees.forEach(tree=>tree.traverse(object=>{if(object.isMesh){const previous=object.material; if(!seasonalMaterials.has(previous))seasonalMaterials.set(previous,{material:previous.clone(),base:previous.color.clone()});object.material=seasonalMaterials.get(previous).material;}}));
  const snow=[];
  for(const [x,z,w,d] of [[0,5,58,42],[0,80,95,109]]){const plane=box(x,.19,z,w,.025,d,'#e4ebed');plane.visible=false;snow.push(plane);}
  scene.children.slice().forEach(object=>{if(object.isMesh && ['b6532c','a34928','a76d4d'].includes(object.material?.color?.getHexString())){const cap=new THREE.Mesh(object.geometry,new THREE.MeshStandardMaterial({color:'#e5eef0'}));cap.position.copy(object.position);cap.position.y+=.14;cap.rotation.copy(object.rotation);cap.userData.roof=object;cap.visible=false;snow.push(cap);scene.add(cap);}});
  const litter = new THREE.InstancedMesh(new THREE.PlaneGeometry(.17,.1),new THREE.MeshStandardMaterial({color:'#d4a25c',side:THREE.DoubleSide}),160);
  const litterTransform = new THREE.Object3D();
  for(let i=0;i<160;i++){litterTransform.position.set((i*7.17%44)-22,.24,(i*11.31%109)+4);litterTransform.rotation.x=-Math.PI/2;litterTransform.rotation.z=i*2.3;litterTransform.updateMatrix();litter.setMatrixAt(i,litterTransform.matrix);}scene.add(litter);
  const blossoms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.13,0),new THREE.MeshStandardMaterial({color:'#eebdce'}),trees.length*9);
  const dummy=new THREE.Object3D();let bi=0;
  trees.forEach(tree=>{for(let i=0;i<9;i++){const a=i*2.4;dummy.position.set(tree.position.x+Math.cos(a)*1.7,tree.position.y+.4+(i%3)*.6,tree.position.z+Math.sin(a)*1.7);dummy.updateMatrix();blossoms.setMatrixAt(bi++,dummy.matrix);}});scene.add(blossoms);
  const particles=new THREE.BufferGeometry(),particleArray=new Float32Array(220*3);
  for(let i=0;i<220;i++){particleArray[i*3]=(i*13.17%48)-24;particleArray[i*3+1]=(i*.31%12);particleArray[i*3+2]=(i*7.13%48)-24;}
  particles.setAttribute('position',new THREE.BufferAttribute(particleArray,3));
  const motes=new THREE.Points(particles,new THREE.PointsMaterial({size:.15,color:'#eabccb',transparent:true,opacity:.8,depthWrite:false}));motes.frustumCulled=false;scene.add(motes);
  const sparkleGeo=new THREE.BufferGeometry();const sparklePositions=new Float32Array(100*3);
  for(let i=0;i<100;i++){sparklePositions[i*3]=(i*7.37%42)-21;sparklePositions[i*3+1]=1+(i*.27%7);sparklePositions[i*3+2]=(i*9.3%30)-4;}
  sparkleGeo.setAttribute('position',new THREE.BufferAttribute(sparklePositions,3));
  const sparkles=new THREE.Points(sparkleGeo,new THREE.PointsMaterial({color:'#ffe7a0',size:.1,transparent:true,opacity:.8}));scene.add(sparkles);sparkles.visible=false;
  let season='summer',weather='sunny',lightOffset=new THREE.Vector3(-24,32,20);
  function applyTime(now){
    season=seasonAt(now);weather=weatherOverride||'sunny';const light=weather==='sunset'?{...lightingAt(18),sun:'#ffce88',power:3.5,ambient:.85,height:17,sky:'#b8c8ca',label:'金色黄昏'}:lightingAt(now.getHours());
    const events=anniversariesToday(config.anniversaries,now);
    const sky=events[0]?.skyColor || (weather==='rain'?'#71848e':weather==='snow'?'#9cabbe':light.sky);
    scene.background.set(sky);scene.fog.color.set(sky);scene.fog.near=65;scene.fog.far=155;
    sun.color.set(light.sun);sun.intensity=light.power*(season==='summer'?1.1:1);hemisphere.intensity=light.ambient;
    lightOffset.set(-28,light.height,weather==='sunset'?-24:20);const night=light.label==='夜晚'||light.label==='暮色';
    lamps.forEach(lamp=>lamp.intensity=night?8:0);nightMaterials.forEach(material=>{material.emissive.set('#ffc77b');material.emissiveIntensity=night?.55:0;});
    seasonalMaterials.forEach(({material,base})=>{material.color.copy(base);if(season==='autumn')material.color.set('#82904c');if(season==='winter')material.color.set('#b0b7aa');if(season==='summer')material.color.set('#4e803f');});
    snow.forEach(mesh=>mesh.visible=season==='winter');blossoms.visible=season==='spring';litter.visible=season==='spring'||season==='autumn';litter.material.color.set(season==='spring'?'#eabccd':'#cc9850');
    const falling=weather==='rain'||weather==='snow'||season!=='summer';motes.visible=falling;
    motes.material.color.set(weather==='rain'?'#c1d9ed':weather==='snow'||season==='winter'?'#eff5ff':season==='spring'?'#edbfd0':'#d6a05b');motes.material.size=weather==='rain'?.075:.17;
    sparkles.visible=events.length>0;anniversaryMessage.hidden=!events.length;anniversaryMessage.textContent=events.map(event=>event.message).join(' · ');
    const seasonNames={spring:'春',summer:'夏',autumn:'秋',winter:'冬'};
    clockLabel.textContent=`${seasonNames[season]} · ${light.label} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    dayPlaque.userData.write(dayText());
  }
  function onKey(e){if(e.shiftKey&&e.code==='KeyH'&&!e.repeat){weatherOverride=weatherOverride?null:config.favoriteWeather;clockStamp='';toast(weatherOverride?'天气悄悄变了。':'回到此刻的天空。');return true;}return false;}
  const lightingButton=node('button','光照：金色黄昏',document.querySelector('.tools'));
  lightingButton.onclick=()=>{weatherOverride=weatherOverride==='sunset'?null:'sunset';clockStamp='';lightingButton.textContent=weatherOverride?'光照：金色黄昏':'光照：此刻';applyTime(new Date());};
  applyTime(new Date());updateJournal();
  if(storageBroken)toast('本地进度读取失败，本次使用新的临时进度。');
  function update(dt,time){
    const now=new Date(),stamp=`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if(stamp!==clockStamp){applyTime(now);clockStamp=stamp;}
    const pos=player.root.position;sun.target.position.copy(pos);if(!sun.target.parent)scene.add(sun.target);sun.position.copy(pos).add(lightOffset);
    near=null;let best=Infinity;
    targets.forEach(item=>{const distance=Math.hypot(pos.x-item.x,pos.z-item.z);if(distance<item.radius&&distance<best){near=item;best=distance;}});
    const d=Math.hypot(pos.x+19,pos.z-14);initials.material.opacity=Math.max(0,Math.min(1,(4-d)/2));
    envelopes.forEach(({envelope,seal,base},i)=>{envelope.position.y=seal.position.y=base+Math.sin(time*1.6+i)*.08;});
    if(coinTime>=0){coinTime+=dt;coin.visible=coinTime<1;coin.position.set(0,1+Math.sin(coinTime*Math.PI)*1.5,8-coinTime*4);coin.rotation.x=time*8;if(coinTime>=1)coinTime=-1;}
    gate.rotation.y=THREE.MathUtils.damp(gate.rotation.y,gateOpen?Math.PI/2:0,5,dt);
    const insideHome=Math.abs(pos.x-20)<6&&pos.z>51&&pos.z<63;roof1.visible=roof2.visible=!insideHome;cottageParts.forEach(wall=>wall.visible=!insideHome);snow.forEach(cap=>{if(cap.userData.roof)cap.visible=season==='winter'&&cap.userData.roof.visible;});
    const t=time*.3;friend.root.position.set(7+Math.sin(t)*1.8,.12,34+Math.cos(t)*1.5);friend.root.rotation.y=Math.atan2(-Math.cos(t),Math.sin(t));animatePerson(friend,time*3,true);friendTarget.x=friend.root.position.x;friendTarget.z=friend.root.position.z;
    parkWalkers.forEach(({visitor,x,z,phase})=>{
      const offset=Math.sin(time*.13+phase)*1.6;
      visitor.root.position.set(x+offset,.12+parkHeight(x+offset,z),z);
      visitor.root.rotation.y=Math.cos(time*.13+phase)>0?-Math.PI/2:Math.PI/2;
      animatePerson(visitor,time*1.8+phase,true);
    });
    flowLines.forEach((line,i)=>{
      const z=59+(i*1.31+time*1.1)%63;
      line.position.set(riverX(z)+((i%5)/4-.5)*(riverWidth(z)-.6),.203,z);
      line.rotation.y=Math.atan2(2.1*Math.PI/26*Math.cos((z-75)*Math.PI/26),1);
    });
    if(motes.visible){motes.position.set(pos.x,0,pos.z);for(let i=0;i<220;i++){const p=i*3;particleArray[p+1]-=dt*(weather==='rain'?12:weather==='snow'||season==='winter'?.75:1.5);particleArray[p]+=Math.sin(time+i)*dt*.18;if(particleArray[p+1]<.2)particleArray[p+1]=12;}particles.attributes.position.needsUpdate=true;}
    if(sparkles.visible)sparkles.position.y=Math.sin(time*.6)*.3;
  }
  return { update, isModal:()=>dialog.open, isSitting:()=>sitting, nearest:()=>near, interact:()=>{if(!near)return false;near.action();return true;}, onKey, photoChanged, drawFrame, isPhoto:()=>document.body.classList.contains('photo') };
}
