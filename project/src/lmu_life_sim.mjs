// Ambient life simulation: no renderer/THREE dependency. Distances are metres.
export const TRAM_PERIOD = 40;
export const TRAM_TRAVEL = 28;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};
export function seededRandom(seed = 714) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function clearSegment(a, b, blocked) {
  const n = Math.max(1, Math.ceil(distance(a, b) / .65));
  for (let i = 0; i <= n; i++) {
    const x = mix(a.x, b.x, i / n), z = mix(a.z, b.z, i / n);
    // Give shoulders some room around fountain rims, walls and bounds.
    if (blocked(x, z) || blocked(x + .4, z) || blocked(x - .4, z) ||
        blocked(x, z + .4) || blocked(x, z - .4)) return false;
  }
  return true;
}

// Small visibility graph: paths can cross the plaza without cutting through a basin.
// Returns [] for an unreachable destination, never an unchecked fallback segment.
export function createWaypoints(start, end, blocked = () => false) {
  if (blocked(start.x, start.z) || blocked(end.x, end.z)) return [];
  if (clearSegment(start, end, blocked)) return [{ ...end }];
  const nodes = [{ ...start }, { ...end }];
  for (const x of [-76, -60, -46, -23, 0, 23, 46, 60, 76])
    for (const z of [14, 22, 34, 62, 76, 84])
      if (!blocked(x, z)) nodes.push({ x, z });
  const costs = nodes.map(() => Infinity), prev = nodes.map(() => -1), used = new Set();
  costs[0] = 0;
  for (let k = 0; k < nodes.length; k++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!used.has(i) && (u < 0 || costs[i] < costs[u])) u = i;
    if (u < 0 || !Number.isFinite(costs[u])) break;
    if (u === 1) {
      const result = [];
      for (let v = 1; v !== 0; v = prev[v]) result.unshift({ ...nodes[v] });
      return result;
    }
    used.add(u);
    for (let v = 1; v < nodes.length; v++) {
      if (used.has(v)) continue;
      const cost = costs[u] + distance(nodes[u], nodes[v]);
      if (cost < costs[v] && clearSegment(nodes[u], nodes[v], blocked)) {
        costs[v] = cost; prev[v] = u;
      }
    }
  }
  return [];
}

// Projection handles even a player teleporting onto an NPC. If walls constrain
// the first escape direction, search around the personal-space circle instead.
export function avoidPoint(pos, obstacle, radius, blocked = () => false, side = 1) {
  if (!obstacle || distance(pos, obstacle) >= radius) return pos;
  const angle = Math.atan2(pos.x - obstacle.x || .001 * side, pos.z - obstacle.z);
  for (let i = 0; i < 32; i++) {
    const a = angle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 16;
    const p = { x: obstacle.x + Math.sin(a) * (radius + .01), z: obstacle.z + Math.cos(a) * (radius + .01) };
    if (!blocked(p.x, p.z)) return p;
  }
  return pos;
}
export function steerPedestrian(actor, target, player, dt, blocked = () => false) {
  dt = clamp(dt, 0, .1);
  let dx = target.x - actor.x, dz = target.z - actor.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  if (player) {
    const pd = distance(actor, player);
    if (pd < 4) {
      const side = actor.side || 1;
      const weight = clamp((4 - pd) / 2, 0, 1.7);
      dx += (actor.x - player.x) / (pd || 1) * weight + dz * .5 * weight * side;
      dz += (actor.z - player.z) / (pd || 1) * weight - dx * .5 * weight * side;
    }
  }
  const desired = Math.atan2(dx, dz);
  const turn = Math.atan2(Math.sin(desired - actor.yaw), Math.cos(desired - actor.yaw));
  actor.yaw += turn * (1 - Math.exp(-dt * 5));
  const step = Math.min(d, (actor.speed || 1) * dt);
  let next = { x: actor.x + Math.sin(actor.yaw) * step, z: actor.z + Math.cos(actor.yaw) * step };
  if (!clearSegment(actor, next, blocked)) {
    next = { x: actor.x + dx * step, z: actor.z + dz * step };
    if (!clearSegment(actor, next, blocked)) next = { x: actor.x, z: actor.z };
  }
  next = avoidPoint(next, player, 1.65, blocked, actor.side);
  actor.moving = distance(actor, next) > .0001;
  actor.x = next.x; actor.z = next.z;
  return actor;
}

export function tramAtTime(time, offset = 4) {
  const phase = ((time + offset) % TRAM_PERIOD + TRAM_PERIOD) % TRAM_PERIOD;
  const visible = phase < TRAM_TRAVEL;
  return { visible, z: -158 + phase / TRAM_TRAVEL * 316, phase, cycle: Math.floor((time + offset) / TRAM_PERIOD) };
}

/** Constant-speed travel along one continuous surveyed lane. Hidden pause at ends
 * avoids connecting separate source ways or jumping across the protected core. */
export function compileLane(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lengths = [0];
  for (let i=1;i<points.length;i++) lengths.push(lengths[i-1]+distance(points[i-1],points[i]));
  return lengths.at(-1)>1 ? {points:points.map(p=>({...p})), lengths, length:lengths.at(-1)} : null;
}
export function laneAtTime(lane,time,speed=6,offset=0,pause=7) {
  if (!lane || !Number.isFinite(time) || !Number.isFinite(speed) || speed<=0) return {visible:false,x:0,z:0,yaw:0};
  const period=lane.length/speed+pause, phase=((time+offset)%period+period)%period;
  const travel=phase*speed, visible=travel<lane.length;
  const d=Math.min(lane.length,travel);
  let i=1;while(i<lane.lengths.length-1 && lane.lengths[i]<d)i++;
  const a=lane.points[i-1], b=lane.points[i], span=lane.lengths[i]-lane.lengths[i-1];
  const t=span ? (d-lane.lengths[i-1])/span : 0;
  return {visible,x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),yaw:Math.atan2(b.x-a.x,b.z-a.z),distance:d,cycle:Math.floor((time+offset)/period)};
}

export function takeOff(flock, blocked, random = Math.random, focus = null) {
  if (flock.state === 'flight') return;
  flock.state = 'flight'; flock.time = 0; flock.duration = 6 + random() * 4;
  flock.from = { x: flock.x, z: flock.z };
  let dest;
  for (let i = 0; i < 24; i++) {
    const a = random() * TAU, r = 12 + random() * 18;
    dest = { x: clamp(flock.x + Math.sin(a) * r, -78, 78), z: clamp(flock.z + Math.cos(a) * r, 17, 78) };
    if ([[-2.2,0],[2.2,0],[0,-2.2],[0,2.2],[0,0]].every(([x,z])=>!blocked(dest.x+x,dest.z+z)) && (!focus || distance(dest, focus) > 7)) break;
    dest = null;
  }
  flock.to = dest || { ...flock.from };
}
export function stepFlock(flock, dt, { player, companion, blocked = () => false, random = Math.random, celebrate = false } = {}) {
  if (flock.state !== 'flight' && (celebrate ||
      (player && distance(flock, player) < 5.1) || (companion && distance(flock, companion) < 5.6)))
    takeOff(flock, blocked, random, companion);
  if (flock.state === 'flight') {
    flock.time += clamp(dt, 0, .1);
    const t = clamp(flock.time / flock.duration, 0, 1), s = smooth(t);
    const circle = Math.sin(Math.PI * t) * 3.5;
    flock.x = mix(flock.from.x, flock.to.x, s) + Math.sin(t * TAU) * circle;
    flock.z = mix(flock.from.z, flock.to.z, s) + Math.cos(t * TAU) * circle;
    flock.y = Math.pow(Math.sin(Math.PI * t), .7) * 7;
    if (t === 1) { flock.state = 'ground'; flock.x = flock.to.x; flock.z = flock.to.z; flock.y = 0; }
  }
  return flock;
}

const LOOPS = [
  [[-76,84], [76,84], [60,65], [50,21.7], [0,34], [-60,65]],
  [[76,82], [-76,82], [-50,21.7], [-60,34], [-60,67]],
  [[-62,35], [-30,21.7], [0,34], [22,65], [60,76], [-60,76]],
  [[60,60], [30,21.7], [60,34], [65,76], [-23,76], [0,60]],
];
export function createLifeSimulation({ blocked = () => false, random = seededRandom(), routes = LOOPS, flockStarts = [[-12,77], [17,61], [-49,35], [54,54]] } = {}) {
  const flocks = flockStarts.map(([x,z], i) => ({ x,z,y:0,state:'ground',time:0,duration:8,id:i }));
  const pedestrians = Array.from({ length: 10 }, (_, i) => {
    const route = routes[i % routes.length].map(p => Array.isArray(p) ? {x:p[0],z:p[1]} : {...p});
    const start = route[i % route.length];
    return { ...start, yaw: Math.PI / 2, speed: .85 + random() * .45, side: i % 2 ? 1 : -1,
      route, goal: (i + 1) % route.length, waypoints: [], idle: 0, seated: false, moving: true, phase: random() * TAU };
  });
  let previousStage = null, endingFlock = null;
  const flockContext = { blocked, random, player: null, companion: null, celebrate: false };
  return {
    flocks, pedestrians,
    update(dt, time, player, companion, stage) {
      dt = clamp(dt, 0, .1);
      const celebrate = stage === 'done' && previousStage !== 'done';
      previousStage = stage;
      // During the postcard conversation the nearest ground flock ambles into
      // a loose ring around the couple, ready for the final celebratory lift.
      // Keep the entire flock outside their photo/personal-space radius.
      const focus = companion || player;
      if (stage === 'postcard' && focus) {
        endingFlock ||= flocks.reduce((best,f)=>distance(f,focus)<distance(best,focus)?f:best);
        if (endingFlock.state === 'ground') {
          const dx=endingFlock.x-focus.x, dz=endingFlock.z-focus.z, d=Math.hypot(dx,dz)||1;
          const target={x:focus.x+dx/d*8, z:focus.z+dz/d*8};
          const step=Math.min(1,dt*.8/(distance(endingFlock,target)||1));
          const next={x:mix(endingFlock.x,target.x,step),z:mix(endingFlock.z,target.z,step)};
          if (clearSegment(endingFlock,next,blocked) && (!player||distance(next,player)>6) && distance(next,focus)>6)
            Object.assign(endingFlock,next);
        }
      }
      flockContext.player = player; flockContext.companion = companion; flockContext.celebrate = celebrate;
      for (const flock of flocks) stepFlock(flock, dt, flockContext);
      for (const p of pedestrians) {
        if (p.idle > 0 && (!player || distance(p, player) > 2.2) &&
            (!companion || distance(p, companion) >= 1.65)) {
          p.idle -= dt; p.moving = false; continue;
        }
        p.seated = false;
        if (!p.waypoints.length) p.waypoints = createWaypoints(p, p.route[p.goal], blocked);
        if (!p.waypoints.length) { p.goal = (p.goal + 1) % p.route.length; continue; }
        const target = p.waypoints[0];
        steerPedestrian(p, target, player, dt, blocked);
        if (companion) Object.assign(p, avoidPoint(p, companion, 1.65, blocked, p.side));
        if (p.moving) p.phase += dt * p.speed * 5.8;
        if (distance(p, target) < .5) {
          p.waypoints.shift();
          if (!p.waypoints.length) {
            const atBench = Math.abs(p.route[p.goal].z - 21.7) < .1;
            p.idle = atBench ? 7 + random() * 6 : .5 + random() * 2;
            p.seated = atBench; if (atBench) { p.x = p.route[p.goal].x; p.z = 21.7; p.yaw = Math.PI; }
            p.goal = (p.goal + 1) % p.route.length;
          }
        }
      }
      return tramAtTime(time);
    },
  };
}
