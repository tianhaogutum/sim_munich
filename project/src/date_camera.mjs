// Conservative camera boom clipping in the same walkability frame as the world.
// A visual camera may sit above a low obstacle; treating its ground footprint as
// solid is intentional so it never crosses a mapped building wall.
export function cameraBoomFraction(from, to, blocked, step = .45, clearance = .25) {
  const dx = to.x - from.x, dz = to.z - from.z, distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance < .001) return 1;
  const count = Math.max(1, Math.ceil(distance / step));
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    if (blocked(from.x + dx * t, from.z + dz * t)) return Math.max(0, t - clearance / distance - 1 / count);
  }
  return 1;
}
