// Nusa Airlift — world: seeded randomness, route geometry and the camera
// projection. One clear job: where things are and how the world maps to screen.

import { ISLANDS, LEGS, WEATHER, islandById } from './config.js';

// Deterministic RNG so screenshot scenes and replays match run to run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function degToRad(d) { return (d * Math.PI) / 180; }
export function radToDeg(r) { return (r * 180) / Math.PI; }

// Each island's strip sits on the shore facing the island's incoming leg,
// so both the landing approach and the takeoff roll run over the sea
// instead of into the volcano: the approach comes from the previous island
// across open water, and the takeoff heads back that way before turning
// onto the route. The strip is derived from the leg chain, which is a
// loop — every island is flown to from exactly one other island.
export function stripFor(island) {
  const leg = LEGS.find((l) => l.to === island.id);
  const from = leg ? islandById(leg.from) : island;
  const dx = from.x - island.x;
  const dz = from.z - island.z;
  const len = Math.hypot(dx, dz) || 1;
  return {
    x: island.x + (dx / len) * island.radius * 0.85,
    z: island.z + (dz / len) * island.radius * 0.85,
    heading: (Math.atan2(dx, dz) * 180) / Math.PI,
  };
}

// Build the sky-ring chain for a leg: rings arc from the departure strip to
// the destination strip, dipping low over the sea and rising over the peaks.
export function buildRings(leg) {
  const from = islandById(leg.from);
  const to = islandById(leg.to);
  // Rings run strip to strip, so the first ring is always ahead of the
  // takeoff roll and the last one gates the destination runway.
  const fromStrip = stripFor(from);
  const toStrip = stripFor(to);
  const sx = fromStrip.x, sz = fromStrip.z;
  const tx = toStrip.x, tz = toStrip.z;
  const rng = mulberry32(leg.id.length * 7919 + leg.rings * 131);
  const rings = [];
  for (let i = 0; i < leg.rings; i++) {
    // Rings span the first two-thirds of the route, so the first one is
    // reachable after the climb-out and the last one leaves a proper final
    // approach to the strip. Altitude ramps with the route: low after
    // takeoff, high at cruise, so a climbing plane can meet each one.
    const t = 0.18 + (i / leg.rings) * 0.52;
    const x = lerp(sx, tx, t) + (rng() - 0.5) * 600;
    const z = lerp(sz, tz, t) + (rng() - 0.5) * 600;
    // Altitude ramps with the route, but never below the terrain: a ring
    // over a volcano slope sits 120 m above the ground there.
    const profileAlt = Math.min(100 + t * 600, 450) + (rng() - 0.5) * 80;
    const alt = Math.max(Math.max(120, profileAlt), terrainHeight(x, z) + 120);
    rings.push({ x, z, alt, radius: 55, passed: false, index: i });
  }
  // Final ring gates the destination runway: it sits on the approach line
  // between the last ring and the strip, a short hop past the last ring,
  // low and over the sea — so the landing starts lined up, with the strip
  // ahead and no volcano between the gate and the runway.
  const last = rings[rings.length - 1];
  const gx = toStrip.x - last.x;
  const gz = toStrip.z - last.z;
  const glen = Math.hypot(gx, gz) || 1;
  const gateDist = Math.min(600, glen * 0.4);
  const gateX = last.x + (gx / glen) * gateDist;
  const gateZ = last.z + (gz / glen) * gateDist;
  rings.push({
    x: gateX, z: gateZ,
    alt: Math.max(150, terrainHeight(gateX, gateZ) + 120),
    radius: 60, passed: false, index: leg.rings, final: true,
  });
  return rings;
}

// Clouds drift over the sea; each has a fixed slot so the scene is stable.
export function buildClouds(seed) {
  const rng = mulberry32(seed);
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: rng() * 12000, z: rng() * 12000,
      alt: 500 + rng() * 700, size: 260 + rng() * 420,
      shade: 0.82 + rng() * 0.18, speed: 6 + rng() * 10,
    });
  }
  return clouds;
}

// A camera projects a world point to the screen. Forward is +f, right is +r,
// up is +h. Points behind the camera return null.
export function project(cam, px, py, pz, view) {
  const dx = px - cam.x;
  const dz = pz - cam.z;
  const sin = Math.sin(cam.heading);
  const cos = Math.cos(cam.heading);
  const f = dx * sin + dz * cos;
  const r = dx * cos - dz * sin;
  if (f < 8) return null;
  const h = py - cam.y;
  const scale = view.focal / f;
  const horizon = view.cy + cam.pitch * view.focal * 0.9;
  return {
    x: view.cx + r * scale,
    y: horizon - h * scale,
    scale,
    dist: f,
  };
}

// Terrain height at a map point: island cones plus flat sea at 0.
export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < isl.radius) {
      const t = 1 - d / isl.radius;
      h = Math.max(h, isl.peak * t * t);
    }
  }
  return h;
}

// Is the point over dry land (above the beach ring)?
export function overLand(x, z) {
  return terrainHeight(x, z) > 4;
}

export function legById(id) {
  return LEGS.find((l) => l.id === id);
}

export function weatherFor(leg) {
  return WEATHER[leg.weather] || WEATHER.clear;
}
