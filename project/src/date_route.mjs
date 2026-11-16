// Shared chapter coordinates in the fixed OSM frame: +X north, +Z east, +Y up.
// Retained geometry and photo evidence: docs/reference/CORE_RELAYOUT_PLAN.md.
// CORE_BOUNDS remains the district exclusion contract, not a collision rectangle.
export const STAGES = ["meet","fountain_talk","find_memento","photos","postcard","done"];
export const POIS = {"entrance":{"x":4,"z":16,"label":"LMU 主入口"},"white_rose":{"x":-4,"z":18,"label":"白玫瑰纪念地"},"fountain":{"x":-5.9,"z":38,"label":"喷泉"},"our_plaza":{"x":-16,"z":53,"label":"我们的广场"},"memento":{"x":-29,"z":23,"label":"纪念物"}};
export const INTERACT_RADIUS = 6.5;
export const FOUNTAINS = [{"x":-8.359394400264932,"z":45.63130378085752,"r":6.1},{"x":-24.193591199885475,"z":97.88746481646685,"r":6.1}];
export const COMPANION = {"waitAt":{"x":6.5,"z":20,"yaw":-0.31},"followDistance":2.2,"catchUpDistance":28,"fountainSeat":{"x":-3.1,"z":38.9}};
export const PHOTO_TARGETS = [{"id":"facade","label":"主楼与拱廊","target":{"x":2,"y":11.5,"z":13.8},"minDist":22,"maxDist":75,"tangent":{"x":0.9528,"z":0.3036},"normal":{"x":-0.3036,"z":0.9528}},{"id":"fountain","label":"喷泉","target":{"x":-8.359394400264932,"y":4.5,"z":45.63130378085752},"minDist":7,"maxDist":32},{"id":"couple","label":"我们的合影","target":"companion","minDist":2,"maxDist":9}];
export const SPAWN = {"x":-52,"z":24,"yaw":-1.4288992721907328};
export const BOUNDS = {"minX":-520,"maxX":520,"minZ":-320,"maxZ":420};
export const CORE_BOUNDS = {"minX":-150,"maxX":150,"minZ":-4,"maxZ":118};
export const ROUTE = { STAGES, POIS, INTERACT_RADIUS, FOUNTAINS, COMPANION, PHOTO_TARGETS, SPAWN, BOUNDS, CORE_BOUNDS };
