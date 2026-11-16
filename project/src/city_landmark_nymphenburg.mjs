// Procedural exterior study, not a surveyed reconstruction. All model dimensions
// are approximate artistic metre-scale proportions, NOT measured palace sizes.
// +X east (town/forecourt), +Y up, +Z south. Host owns geographic placement.
export const NYMPHENBURG = Object.freeze({
  id: 'city-landmark-nymphenburg', name: '宁芬堡宫 · Schloss Nymphenburg',
  lon: 11.5036, lat: 48.1581,
  accuracy: 'Approximate exterior study; anchor from session09 building record. Dimensions, bay counts, roof slopes and forecourt layout are simplified, not surveyed.',
  scope: 'Central pavilion, connecting galleries, two pavilions on each side and a small east forecourt. Outer crescent, interiors, sculpture and the full canal system are omitted.',
});

export const NYMPHENBURG_SOURCES = Object.freeze([
  Object.freeze({
    title: 'Bayerische Schlösserverwaltung — palace history',
    url: 'https://www.schloss-nymphenburg.de/englisch/palace/index.htm',
    credit: 'Institutional reference: central cubic pavilion, north/south pavilions and linking galleries. Aerial photograph credited there to Bayerische Schlösserverwaltung / Florian Schröter. No photograph is embedded.',
  }),
  Object.freeze({
    title: 'Bayerische Schlösserverwaltung — complex plan and picture gallery',
    url: 'https://www.schloss-nymphenburg.de/englisch/park/plan.htm',
    credit: 'Reference for the relationship of palace, park and town-side forecourt. The small modeled forecourt is a schematic excerpt, not the full crescent or a navigation surface.',
  }),
  Object.freeze({
    title: 'Commons — Schloss Nymphenburg Fassade-Detail.jpg',
    url: 'https://commons.wikimedia.org/wiki/File:Schloss_Nymphenburg_Fassade-Detail.jpg',
    credit: 'Johannes Schlund (JohannesSch. / Serafim 89), CC BY-SA 3.0 Unported. West facade detail, as recorded in session09; used for window/trim rhythm, not as an east-elevation survey. Procedural simplification; no image or texture copied.',
    license: 'https://creativecommons.org/licenses/by-sa/3.0/',
  }),
]);

const COLORS = Object.freeze({wall:0xe9d6ad, trim:0xf5efdf, roof:0x5b6262,
  glass:0x354c54, door:0x514331, stone:0xb5aca0, gravel:0xc9bda6, grass:0x7a895c});

// Data-only plan keeps geography, footprint and repetition testable without GL.
// Widths use scene axes: x = depth, z = facade length.
export function planNymphenburg() {
  const parts = [];
  const put = (label, material, x,y,z, sx,sy,sz, shape='box') =>
    parts.push({label, material, shape, position:[x,y,z], size:[sx,sy,sz]});
  function facade(label, x,z,depth,width,height,bays,levels) {
    put(label, 'wall', x,height/2,z, depth,height,width);
    put(`${label}-plinth`, 'stone', x,.45,z, depth+.5,.9,width+.5);
    put(`${label}-eaves`, 'trim', x,height-.1,z, depth+.9,.6,width+.9);
    for (let level=1;level<levels;level++)
      put(`${label}-stringcourse`, 'trim', x,height*level/levels,z, depth+.4,.32,width+.4);
    // Both broad elevations have rhythmic openings. Rear is deliberately simplified.
    for (const side of [-1,1]) {
      const faceX=x+side*(depth/2+.09);
      for (let bay=0;bay<bays;bay++) {
        const bz=z+(bay-(bays-1)/2)*(width/(bays+.5));
        for (let row=0;row<levels;row++) {
          const y=(row+.52)*height/levels;
          const wh=height/levels*.54, ww=Math.min(1.9,width/bays*.37);
          put(`${label}-window-surround`, 'trim', faceX,y,bz, .24,wh+.5,ww+.5);
          put(`${label}-window`, 'glass', faceX+side*.14,y,bz, .08,wh,ww);
          put(`${label}-window-mullion`, 'trim', faceX+side*.19,y,bz, .06,wh,.09);
          put(`${label}-window-transom`, 'trim', faceX+side*.19,y+.25,bz, .06,.09,ww);
        }
      }
      // Corner pilasters express the pale vertical rhythm without textures.
      for (const edge of [-1,1])
        put(`${label}-pilaster`, 'trim', faceX,height/2,z+edge*(width/2-.65), .32,height, .8);
    }
  }
  facade('central-pavilion',0,0,29,42,24,7,3);
  put('central-hip-roof','roof',0,27.5,0,31,7,44,'hip');
  // Central town-side portal and shallow upper risalit; no interior traversal.
  put('central-risalit','wall',14.8,13,0,1.1,21,16);
  for (const z of [-6,-2,2,6]) {
    put('central-pilaster','trim',15.5,13,z,.45,21,.65);
    for (const y of [12.5,20]) {
      put('central-window-frame','trim',15.55,y,z,.35,4.6,2.5);
      put('central-window','glass',15.78,y,z,.12,4.1,1.9);
    }
  }
  for(const z of [-4,0,4]) {
    put('portal-frame','trim',15.5,2.5,z,.5,5,2.9);
    put('portal','door',15.8,2.35,z,.12,4.7,2.2);
  }
  // Low, pale parapet strip rather than an invented monumental pediment.
  put('central-front-cornice','trim',15.5,23.6,0,1.2,.7,17.2);
  for (let i=0;i<4;i++)
    put('entrance-step','stone',17.2+i*.8,.14*(4-i),0,1.7,.28*(4-i),15+i*1.5);

  // Stepped, symmetrical ensemble: roof ridge follows the north/south facade.
  for (const side of [-1,1]) {
    facade('inner-gallery',2,side*35,16,28,10.4,6,2);
    put('inner-gallery-roof','roof',2,12.4,side*35,18,4,30,'hip');
    facade('inner-pavilion',5,side*62,24,26,17.5,5,3);
    put('inner-pavilion-roof','roof',5,20.4,side*62,26,5.8,28,'hip');
    facade('outer-gallery',9,side*89,16,28,10.4,6,2);
    put('outer-gallery-roof','roof',9,12.4,side*89,18,4,30,'hip');
    facade('outer-pavilion',13,side*117,27,28,18,5,3);
    put('outer-pavilion-roof','roof',13,21,side*117,29,6,30,'hip');
  }
  // Small town-side apron and paired planted strips; no blanket over map tiles,
  // no canal/water invented at the arrival point, no navigation/collision changes.
  put('forecourt-apron','gravel',32,.035,0,31,.07,56);
  for (const side of [-1,1]) {
    put('forecourt-path','gravel',31,.04,side*49,26,.08,36);
    put('forecourt-bed-border','stone',30,.12,side*49,14,.24,24);
    put('forecourt-planted-bed','grass',30,.26,side*49,12,.08,22);
  }
  return parts;
}

// Closed unit hipped roof. Ridge along Z, centered about zero for instance scale.
export const NYMPHENBURG_ROOF = Object.freeze({
  positions: Object.freeze([-.5,-.5,-.5, .5,-.5,-.5, .5,-.5,.5, -.5,-.5,.5, 0,.5,-.3, 0,.5,.3]),
  indices: Object.freeze([0,4,1, 3,2,5, 0,3,5, 0,5,4, 1,4,5, 1,5,2, 0,1,2, 0,2,3]),
});

function populateSources(engine) {
  if (!engine.document || !engine.createPanel) return null;
  const panel = engine.createPanel(`${NYMPHENBURG.id}-sources`, {title:NYMPHENBURG.name, modal:true});
  const doc=engine.document;
  const appendText=(tag,text,parent=panel.body)=>{const el=doc.createElement(tag);el.textContent=text;parent.appendChild(el);return el;};
  appendText('p', NYMPHENBURG.accuracy);
  appendText('p', NYMPHENBURG.scope);
  const list=appendText('ul','');
  for (const source of NYMPHENBURG_SOURCES) {
    const item=appendText('li','',list);
    const link=appendText('a',source.title,item);
    link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
    appendText('p',source.credit,item);
    if(source.license){const license=appendText('a','CC BY-SA 3.0 license',item);license.href=source.license;license.target='_blank';license.rel='noopener noreferrer';}
  }
  return panel;
}

export function createFeature(engine) {
  if (!engine?.THREE || typeof engine.addGeoObject !== 'function')
    throw new TypeError('Nymphenburg requires engine.THREE and engine.addGeoObject');
  const THREE=engine.THREE;
  const group=new THREE.Group();group.name=NYMPHENBURG.id;
  group.userData={...NYMPHENBURG,sources:NYMPHENBURG_SOURCES};
  const geometries=[], materials=[], meshes=[];
  let detach, panel, unregister, disposed=false;
  function dispose() {
    if(disposed)return;
    disposed=true;
    try { detach?.(); } finally {
      try { panel?.dispose(); } finally {
        unregister?.();
        for(const mesh of meshes)mesh.dispose?.();
        for(const geometry of geometries)geometry.dispose();
        for(const material of materials)material.dispose();
        group.clear();
      }
    }
  }
  try {
    const box=new THREE.BoxGeometry(1,1,1);geometries.push(box);
    const roof=new THREE.BufferGeometry();geometries.push(roof);
    roof.setAttribute('position',new THREE.Float32BufferAttribute(NYMPHENBURG_ROOF.positions,3));
    roof.setIndex([...NYMPHENBURG_ROOF.indices]);roof.computeVertexNormals();
    const batches=new Map(), materialByName=new Map();
    for(const part of planNymphenburg()) {
      const key=`${part.shape}:${part.material}`;
      if(!batches.has(key))batches.set(key,[]);
      batches.get(key).push(part);
    }
    const dummy=new THREE.Object3D();
    for(const [key,parts] of batches) {
      const {shape,material}=parts[0];
      if(!materialByName.has(material)) {
        const mat=new THREE.MeshLambertMaterial({color:COLORS[material]});
        materials.push(mat);materialByName.set(material,mat);
      }
      const mesh=new THREE.InstancedMesh(shape==='hip'?roof:box,materialByName.get(material),parts.length);
      meshes.push(mesh);mesh.name=`${NYMPHENBURG.id}-${key}`;
      parts.forEach((part,i)=>{dummy.position.set(...part.position);dummy.scale.set(...part.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();group.add(mesh);
    }
    // Only the host touches geographic transforms or suppresses anchor polygons.
    detach=engine.addGeoObject({group,lon:NYMPHENBURG.lon,lat:NYMPHENBURG.lat,
      minZoom:13,maxDistance:6000,replaceBuildings:true,
      replacementOffsets:planNymphenburg().filter(p=>['central-pavilion','inner-gallery','inner-pavilion','outer-gallery','outer-pavilion'].includes(p.label)).map(p=>[p.position[0],p.position[2]])});
    panel=populateSources(engine);
    unregister=engine.onDispose?.(dispose);
  } catch(error) { dispose();throw error; }
  return {group,credits:NYMPHENBURG_SOURCES,
    openSources(){if(!disposed)panel?.open();},
    isOpen(){return !disposed && Boolean(panel?.isOpen());},
    dispose,
  };
}
