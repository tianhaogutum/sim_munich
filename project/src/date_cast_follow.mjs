// Collision-aware companion movement; pure logic, independent of Three.js and DOM.
export function hasClearance(x, z, blocked, radius = .28) {
  return !blocked(x, z) && !blocked(x + radius, z) && !blocked(x - radius, z) &&
    !blocked(x, z + radius) && !blocked(x, z - radius);
}

export function clearCastSegment(a, b, blocked, radius = .28) {
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  const count = Math.max(1, Math.ceil(distance / .22));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (!hasClearance(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, blocked, radius)) return false;
  }
  return true;
}

// Search from the requested location, rather than snapping blindly into a wall.
export function safeCastPosition(target, blocked, maxRadius = 5, avoid = null) {
  const usable = p => hasClearance(p.x, p.z, blocked) &&
    (!avoid || Math.hypot(p.x - avoid.x, p.z - avoid.z) >= .85);
  if (usable(target)) return { x: target.x, z: target.z };
  for (let radius = .5; radius <= maxRadius; radius += .5) {
    const count = Math.max(12, Math.ceil(radius * 10));
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const p = { x: target.x + Math.cos(angle) * radius, z: target.z + Math.sin(angle) * radius };
      if (usable(p)) return p;
    }
  }
  return null;
}

// Bounded A*: cheap direct visibility first, then a small local grid around the actors.
// A failed route returns [] and keeps the actor stationary; never cuts through geometry.
export function planCastPath(start, target, blocked, { spacing = .9, maxNodes = 3500, margin = 9 } = {}) {
  if (!hasClearance(start.x, start.z, blocked) || !hasClearance(target.x, target.z, blocked)) return [];
  if (clearCastSegment(start, target, blocked)) return [{ x: target.x, z: target.z }];
  const minX = Math.min(start.x, target.x) - margin, maxX = Math.max(start.x, target.x) + margin;
  const minZ = Math.min(start.z, target.z) - margin, maxZ = Math.max(start.z, target.z) + margin;
  const key = (ix, iz) => `${ix},${iz}`;
  const toPoint = n => ({ x: start.x + n.ix * spacing, z: start.z + n.iz * spacing });
  const first = { ix: 0, iz: 0, cost: 0, rank: Math.hypot(target.x - start.x, target.z - start.z), prev: null };
  const open = [first], best = new Map([[key(0, 0), first]]), closed = new Set();
  const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found = null;
  for (let visited = 0; open.length && visited < maxNodes; visited++) {
    let lowest = 0;
    for (let i = 1; i < open.length; i++) if (open[i].rank < open[lowest].rank) lowest = i;
    const node = open.splice(lowest, 1)[0], id = key(node.ix, node.iz);
    if (closed.has(id)) continue;
    closed.add(id);
    const point = toPoint(node), distance = Math.hypot(target.x - point.x, target.z - point.z);
    if (distance < spacing * 1.5 && clearCastSegment(point, target, blocked)) { found = node; break; }
    for (const [dx, dz] of offsets) {
      const ix = node.ix + dx, iz = node.iz + dz, nextId = key(ix, iz);
      if (closed.has(nextId)) continue;
      const next = { x: start.x + ix * spacing, z: start.z + iz * spacing };
      if (next.x < minX || next.x > maxX || next.z < minZ || next.z > maxZ || !clearCastSegment(point, next, blocked)) continue;
      const cost = node.cost + Math.hypot(dx, dz) * spacing;
      if (best.has(nextId) && best.get(nextId).cost <= cost) continue;
      const candidate = { ix, iz, cost, rank: cost + Math.hypot(target.x - next.x, target.z - next.z), prev: node };
      best.set(nextId, candidate); open.push(candidate);
    }
  }
  if (!found) return [];
  const points = [{ x: target.x, z: target.z }];
  for (let n = found; n?.prev; n = n.prev) points.push(toPoint(n));
  points.reverse();
  // Visibility smoothing removes grid zig-zag without dropping collision checks.
  const path = [];
  let current = start, index = 0;
  while (index < points.length) {
    let furthest = index;
    for (let i = index + 1; i < points.length; i++) if (clearCastSegment(current, points[i], blocked)) furthest = i;
    path.push(points[furthest]); current = points[furthest]; index = furthest + 1;
  }
  return path;
}

export function moveCastAlongPath(position, path, speed, dt, blocked) {
  let remaining = Math.max(0, speed) * Math.min(.08, Math.max(0, dt));
  const beforeX = position.x, beforeZ = position.z;
  while (path.length && remaining > 0) {
    const next = path[0], dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz);
    if (distance < .025) { path.shift(); continue; }
    const amount = Math.min(distance, remaining), candidate = { x: position.x + dx / distance * amount, z: position.z + dz / distance * amount };
    if (!clearCastSegment(position, candidate, blocked)) { path.length = 0; break; }
    position.x = candidate.x; position.z = candidate.z; remaining -= amount;
    if (amount >= distance) path.shift();
  }
  return Math.hypot(position.x - beforeX, position.z - beforeZ);
}
