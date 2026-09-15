// Parked Rolls-Royce-inspired saloon with a visible driver and chrome grille.
export function createLuxurySedan(THREE,scene,hero,obstacle){
  const root=new THREE.Group();root.name='male-lead-rolls-royce';root.position.set(20,.22,27.4);root.rotation.y=-Math.PI/2;scene.add(root);
  const paint=new THREE.MeshStandardMaterial({color:'#11151c',metalness:.65,roughness:.26});
  const chrome=new THREE.MeshStandardMaterial({color:'#b9c8cf',metalness:.65,roughness:.22});
  const dark=new THREE.MeshStandardMaterial({color:'#141419',roughness:.8});
  const glass=new THREE.MeshStandardMaterial({color:'#92b9c7',transparent:true,opacity:.18,roughness:.12,depthWrite:false,side:THREE.DoubleSide});
  const lamp=new THREE.MeshStandardMaterial({color:'#f6f5e5',emissive:'#fff3d6',emissiveIntensity:.5});
  function mesh(g,m,x,y,z){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  const box=(m,x,y,z,w,h,d)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  // A tall, long bonnet and upright grille distinguish the limousine silhouette.
  box(paint,0,.64,0,2.12,.66,5.8);
  box(paint,0,1.03,-1.65,2.04,.24,2.25);
  box(paint,0,1.03,2.23,2.02,.25,1.24);
  box(dark,0,.4,0,1.86,.2,5.85);
  box(paint,0,1.94,.42,1.91,.13,2.9);
  box(glass,0,1.53,-1.01,1.79,.73,.025);
  box(glass,0,1.53,1.88,1.79,.73,.025);
  for(const side of [-1,1]){
    box(glass,side*.956,1.53,.43,.025,.7,2.8);
    for(const z of [-1.01,.36,1.87])box(paint,side*.96,1.53,z,.095,.85,.095);
    box(chrome,side*1.065,1.08,.32,.025,.04,3.3);
    for(const z of [-.15,.7])box(chrome,side*1.078,1.01,z,.03,.055,.22);
    box(dark,side*1.068,.76,.36,.018,.51,.025);
    box(paint,side*1.16,1.24,-.8,.26,.14,.23);
    for(const z of [-1.87,1.86]){
      const tyre=mesh(new THREE.CylinderGeometry(.46,.46,.25,40),dark,side*1.04,.46,z);tyre.rotation.z=Math.PI/2;
      const wheel=mesh(new THREE.CylinderGeometry(.34,.34,.025,32),chrome,side*1.18,.46,z);wheel.rotation.z=Math.PI/2;
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        mesh(new THREE.SphereGeometry(.035,8,6),dark,side*1.198,.46+Math.cos(a)*.255,z+Math.sin(a)*.255);
      }
    }
    box(lamp,side*.78,1.0,-2.918,.38,.19,.04);
    box(chrome,side*.78,.98,-2.9,.46,.28,.03);
    box(lamp,side*.78,1.0,-2.94,.36,.14,.02);
    box(new THREE.MeshStandardMaterial({color:'#981d29'}),side*.84,.99,2.92,.18,.26,.025);
    box(dark,side*.46,.95,.48,.56,.17,.7);
    box(dark,side*.46,1.21,.87,.56,.65,.15);
  }
  box(chrome,0,.88,-2.94,1.03,.81,.07);
  box(dark,0,.88,-2.987,.91,.67,.02);
  for(let i=-6;i<=6;i++)box(chrome,i*.065,.88,-3.005,.024,.63,.023);
  box(chrome,0,.42,-2.96,1.98,.09,.09);
  const ornament=mesh(new THREE.ConeGeometry(.048,.15,8),chrome,0,1.3,-2.65);
  ornament.rotation.z=.18;
  box(dark,0,1.18,-.75,1.75,.2,.35);
  const steering=mesh(new THREE.TorusGeometry(.19,.025,8,24),dark,-.46,1.36,-.43);steering.rotation.x=-.5;
  hero.seated=true;root.add(hero.root);hero.root.position.set(-.46,.02,.43);hero.root.rotation.set(0,0,0);hero.root.scale.setScalar(.72);
  hero.legs.forEach(leg=>leg.rotation.x=-Math.PI/2);
  hero.arms.forEach(arm=>arm.rotation.x=-.9);
  obstacle(20,27.4,6.1,2.4);
  return root;
}
