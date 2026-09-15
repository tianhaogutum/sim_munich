// Separate fantasy coast, outside the reconstructed Munich neighborhood.
export function coastBlocked(x,z){return x<275.5||x>324.5||z<9||z>28.5||[-20,20].some(offset=>Math.abs(x-(300+offset))<1.9&&Math.abs(z-23)<.9);}
export function addSunsetCoast({THREE,scene,player,sun,stopTour,canTravel,setView,toast}){
  const group=new THREE.Group();group.name='sunset-coast';group.position.set(300,0,0);scene.add(group);
  const uniforms={time:{value:0}};
  // Shared atmospheric palette: blue upper sky, amber horizon, layered cloud ribbons.
  const atmosphere=`
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=mat2(.8,.6,-.6,.8)*p*2.03+13.7;a*=.5;}return f;}
    vec3 sky(vec3 d){
      float h=max(d.y,0.);float glow=exp(-length(d.xz-vec2(-.15,-1.))*2.);
      vec3 c=mix(vec3(.83,.43,.19),vec3(.13,.27,.37),smoothstep(.015,.42,h));
      c+=vec3(.28,.16,.035)*exp(-h*16.)*glow;
      // Domain-warped cloud fields avoid parallel stripes and mirrored sky patterns.
      vec2 p=d.xz/(h+.22)*2.4;
      vec2 warp=vec2(fbm(p*.7),fbm(p*.7+17.));
      float density=fbm(p*vec2(1.,2.4)+warp*.9);
      float cloud=smoothstep(.34,.76,density)*smoothstep(.006,.06,h);
      float rim=clamp((fbm(p*vec2(1.,2.4)+warp*.9+vec2(0.,.15))-density)*3.+.4,0.,1.);
      vec3 cloudColor=mix(vec3(.27,.29,.31),vec3(.92,.48,.18),rim*exp(-h*3.5));
      c=mix(c,cloudColor,cloud*.73);
      float disc=length(d-normalize(vec3(-.15,.027,-1.)));
      c+=vec3(.55,.25,.06)*exp(-disc*22.);
      c=mix(c,vec3(1.,.87,.5), (1.-smoothstep(.009,.011,disc))*(1.-cloud*.7));
      return c;
    }`;
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;${atmosphere}void main(){gl_FragColor=vec4(sky(normalize(direction)),1.);}`});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(115,48,32),skyMat);dome.position.set(0,0,18);group.add(dome);
  const seaMat=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,
    vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader:`uniform float time;varying vec3 world;${atmosphere}
      float wave(vec2 p){
        return sin(dot(p,vec2(.7,.9))*.85+time*.7)*.035
          +sin(dot(p,vec2(-.8,.3))*1.8-time*1.1)*.018
          +sin(dot(p,vec2(.3,1.)) *3.7+time*1.5+fbm(p*.5)*3.)*.009;
      }
      void main(){vec2 p=world.xz;
        float e=.07;float dx=(wave(p+vec2(e,0))-wave(p-vec2(e,0)))/(2.*e);
        float dz=(wave(p+vec2(0,e))-wave(p-vec2(0,e)))/(2.*e);
        float attenuation=mix(1.,.22,smoothstep(12.,100.,distance(world,cameraPosition)));
        vec3 n=normalize(vec3(-dx*attenuation,1.,-dz*attenuation));vec3 view=normalize(world-cameraPosition);
        vec3 reflected=reflect(view,n);float fresnel=.035+.965*pow(1.-max(dot(-view,n),0.),5.);
        vec3 c=mix(vec3(.085,.15,.16),sky(reflected),.48+.52*fresnel);
        vec3 halfDir=normalize(normalize(vec3(-.15,.027,-1.))-view);
        float spec=pow(max(dot(n,halfDir),0.),260.);
        c+=vec3(1.,.65,.25)*spec*.8;
        float shore=6.9+sin(p.x*.31+time*.45)*.2+noise(p*.8)*.18;
        float foam=(1.-smoothstep(.025,.2,abs(world.z-shore)))*smoothstep(.38,.7,noise(p*8.));
        c=mix(c,vec3(.72,.68,.53),foam*.7);
        gl_FragColor=vec4(c,1.);
      }
      `});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(210,115),seaMat);water.rotation.x=-Math.PI/2;water.position.set(0,.05,-49);group.add(water);
  // Deterministic sand grains, shallow wind ripples and a continuous moisture gradient.
  const size=512,pixels=new Uint8Array(size*size*4);let seed=947;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const ripple=Math.sin(y*.15+Math.sin(x*.024)*2)*3;
    const value=164+(random()-.5)*37+ripple;
    pixels[i]=value+18;pixels[i+1]=value+4;pixels[i+2]=value-18;pixels[i+3]=255;
  }
  const sandMap=new THREE.DataTexture(pixels,size,size);sandMap.colorSpace=THREE.SRGBColorSpace;
  sandMap.wrapS=sandMap.wrapT=THREE.RepeatWrapping;sandMap.repeat.set(12,5);sandMap.needsUpdate=true;
  const sandMat=new THREE.MeshStandardMaterial({color:'#c7b99e',map:sandMap,bumpMap:sandMap,bumpScale:.025,roughness:.92});
  sandMat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 beachPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nbeachPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 beachPosition;').replace('#include <color_fragment>',`#include <color_fragment>
      float wetness=1.-smoothstep(-11.,-6.,beachPosition.z+sin(beachPosition.x*.5)*.3);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.59,.64,.68),wetness);`);
  };
  const sand=new THREE.Mesh(new THREE.BoxGeometry(60,.25,25),sandMat);sand.position.set(0,-.12,19);sand.receiveShadow=true;group.add(sand);
  // Subtle stones and shell fragments break up an otherwise perfect plane.
  const stones=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshStandardMaterial({color:'#938674',roughness:.95}),95);
  const transform=new THREE.Object3D();
  for(let i=0;i<95;i++){
    transform.position.set((random()-.5)*53,.015,10+random()*18);
    const r=.025+random()*.06;transform.scale.set(r,.02+random()*.025,r*.7);
    transform.rotation.y=random()*Math.PI;transform.updateMatrix();stones.setMatrixAt(i,transform.matrix);
  }
  stones.receiveShadow=true;group.add(stones);
  const wood=new THREE.MeshStandardMaterial({color:'#715443',roughness:.85});
  for(const x of [-20,20]){
    for(const dx of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.6,.8),wood);leg.position.set(x+dx,.3,23);group.add(leg);}
    const seat=new THREE.Mesh(new THREE.BoxGeometry(3,.14,.85),wood);seat.position.set(x,.65,23);group.add(seat);
  }
  const button=document.createElement('button');button.textContent='去海边看日落';document.querySelector('.tools').append(button);
  let active=false,returnPosition=null;
  button.onclick=()=>{
    if(!canTravel()){toast('请先结束当前互动或停车下车');return;}
    stopTour();
    if(active){player.root.position.copy(returnPosition);setView(0);}
    else{returnPosition=player.root.position.clone();player.root.position.set(300,.12,19);setView(0);}
  };
  const mapStyle=document.createElement('style');mapStyle.textContent='.at-sunset-coast .neighborhood-map canvas,.at-sunset-coast .neighborhood-map button,.at-sunset-coast .neighborhood-map .map-caption{display:none!important}';document.head.append(mapStyle);
  const hiddenParticles=new Map();
  const previous={color:sun.color.clone(),intensity:sun.intensity};
  function update(time){
    const onCoast=player.root.position.x>250;
    if(active&&!onCoast){sun.color.copy(previous.color);sun.intensity=previous.intensity;for(const [object,visible] of hiddenParticles)object.visible=visible;hiddenParticles.clear();}
    if(!active&&onCoast){previous.color.copy(sun.color);previous.intensity=sun.intensity;}
    active=onCoast;document.body.classList.toggle('at-sunset-coast',active);group.visible=active;button.textContent=active?'返回校园':'去海边看日落';
    if(!active)return;
    scene.traverse(object=>{if(object.isPoints){if(!hiddenParticles.has(object))hiddenParticles.set(object,object.visible);object.visible=false;}});
    uniforms.time.value=time;sun.color.set('#ffba72');sun.intensity=2.2;
    sun.position.set(player.root.position.x-18,12,player.root.position.z-80);
    const compass=document.getElementById('compass');compass.textContent='夕阳海岸 · 沿沙滩散步';
  }
  return {update};
}
