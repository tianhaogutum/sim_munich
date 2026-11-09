// date_geo.mjs — real-world (WGS84) ↔ game-world mapping. Owner: integrator. Pure, no THREE.
//
// Game convention: +X = real NORTH, +Z = real EAST, +Y up, 1 unit = 1 m (a pure rotation of the usual
// east/south frame, chosen so the LMU main facade, which faces east in reality, faces +Z in the game).
// Origin = the centre of the LMU main portal (Geschwister-Scholl-Platz 1), which sits at game (0, 0, 0)
// with the facade line at z = 0. Ludwigstraße therefore runs along +X at z ≈ 70–95.
//
// NOTE: the core plaza built before this file (fountains at (±35, 48), the game's road at x ≈ 112–145)
// is stylised and does not follow this mapping yet; new blocks built from OSM data do.

export const ORIGIN = { lat: 48.15075, lon: 11.58035 };   // LMU Hauptgebäude portal (approx.)
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);

/** WGS84 → game metres. Returns { x, z } (x north, z east). */
export function toWorld(lat, lon) {
  return {
    x: (lat - ORIGIN.lat) * M_PER_DEG_LAT,
    z: (lon - ORIGIN.lon) * M_PER_DEG_LON,
  };
}

/** Game metres → WGS84. */
export function fromWorld(x, z) {
  return {
    lat: ORIGIN.lat + x / M_PER_DEG_LAT,
    lon: ORIGIN.lon + z / M_PER_DEG_LON,
  };
}

/** Convert an OSM-style ring [[lon, lat], ...] (GeoJSON order) to game-space [{ x, z }, ...]. */
export function ringToWorld(ring) {
  return ring.map(([lon, lat]) => toWorld(lat, lon));
}

/** Axis-aligned bounds of a game-space polygon, as the obstacle shape used by engine.addObstacle. */
export function polygonBounds(points) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, hw: (maxX - minX) / 2, hd: (maxZ - minZ) / 2 };
}

/** Point-in-polygon (even-odd) for game-space polygons; use for precise collision of OSM footprints. */
export function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Heading of a real-world bearing (degrees clockwise from north) as a game yaw around +Y. */
export function bearingToYaw(bearingDeg) {
  // Facing north (+X) is yaw 0 in this helper's convention; east (+Z) is -90° (= -π/2).
  return -bearingDeg * Math.PI / 180;
}
