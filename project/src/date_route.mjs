// date_route.mjs — shared, READ-ONLY route data for the "Munich date" chapter.
// Owner: integrator. Other agents: do not edit; ask the integrator if a coordinate must change.
//
// World convention used by anime_main.js:
//   +X = east, +Y = up, +Z = south (toward the plaza and the player's spawn).
//   Main building facade is at z = 0 and faces +Z; the building occupies z ∈ [-22, 0].
//   Plaza: x ∈ [-100, 100], z ∈ [0, 80]. Fountain basins at (±35, 48), radius 5.

export const STAGES = ['meet', 'fountain_talk', 'find_memento', 'photos', 'postcard', 'done'];

// Interactable points of interest (ground positions). E within INTERACT_RADIUS triggers them.
export const POIS = {
  entrance:   { x: 0,   z: 5,  label: 'LMU 主入口' },        // existing sight; stage 'meet'
  white_rose: { x: 0,   z: 55, label: '白玫瑰纪念地' },       // existing sight; optional
  fountain:   { x: 35,  z: 40, label: '喷泉' },              // existing sight (basin edge); stage 'fountain_talk'
  our_plaza:  { x: 0,   z: 75, label: '我们的广场' },         // existing sight; stage 'postcard'
  memento:    { x: -44, z: 68, label: '纪念物' },             // hidden until stage 'find_memento'
};

export const INTERACT_RADIUS = 6.5;

export const FOUNTAINS = [
  { x: -35, z: 48, r: 5.4 },
  { x:  35, z: 48, r: 5.4 },
];

export const COMPANION = {
  waitAt: { x: 2.5, z: 10.5, yaw: 0 },     // stage 'meet': waits at the foot of the entrance steps, facing the plaza
  followDistance: 2.2,                      // preferred gap behind/beside the player
  catchUpDistance: 28,                      // beyond this, snap to a free spot near the player
  fountainSeat: { x: 30.5, z: 43.5 },       // stage 'fountain_talk': where the companion stands for the chat
};

// Photo goals for stage 'photos'. `target: 'companion'` = the companion must be in frame.
export const PHOTO_TARGETS = [
  { id: 'facade',   label: '主楼与廊柱', target: { x: 0,  y: 8,   z: 3  }, minDist: 22, maxDist: 75 },
  { id: 'fountain', label: '喷泉',       target: { x: 35, y: 4.5, z: 48 }, minDist: 7,  maxDist: 32 },
  { id: 'couple',   label: '我们的合影', target: 'companion',             minDist: 2,  maxDist: 9  },
];

export const SPAWN = { x: 0, z: 92, yaw: 0 };
// World limits. The playable core is the plaza; blocks built from OSM data extend it (see date_geo.mjs).
export const BOUNDS = { minX: -520, maxX: 520, minZ: -320, maxZ: 420 };
export const CORE_BOUNDS = { minX: -150, maxX: 150, minZ: -4, maxZ: 118 };   // the original plaza limits

export const ROUTE = { STAGES, POIS, INTERACT_RADIUS, FOUNTAINS, COMPANION, PHOTO_TARGETS, SPAWN, BOUNDS, CORE_BOUNDS };
