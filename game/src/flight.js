// Nusa Airlift — flight model: the plane's state and one physics step.
// One clear job: how the aircraft moves, burns fuel and takes damage.

import { clamp, wrapAngle, terrainHeight, overLand, stripFor } from './world.js';
import { WEATHER } from './config.js';

export const KNOTS_TO_MS = 0.514444;
export const FT_TO_M = 0.3048;

export function newPlane(leg, refits) {
  const from = leg.fromIsland;
  // The strip faces the destination island, so the takeoff roll already
  // points down the route and the first ring lies straight ahead.
  const strip = stripFor(from);
  return {
    // Position: metres on the map, altitude in metres above the sea.
    // The strip sits on a beach slope, so the wheels start on the ground
    // there, not at sea level — and on the ground, not above it: a plane
    // spawned even a few metres up reads as airborne and stalling, and
    // slams back onto the runway on the first frame.
    x: strip.x, z: strip.z, y: terrainHeight(strip.x, strip.z) + 1,
    heading: (strip.heading * Math.PI) / 180,
    pitch: 0, roll: 0,
    speed: 0, // knots
    throttle: 0,
    fuel: 100,
    damage: 0,
    onGround: true,
    verticalSpeed: 0, // ft/min, for the HUD and landing judgement
    flaps: false,
    gearDown: true,
    stalled: false,
    // Refit-derived performance.
    maxSpeed: 165 + (refits.has('engine') ? 18 : 0),
    climbRate: 9 + (refits.has('prop') ? 2.2 : 0),
    fuelCapacity: refits.has('tank') ? 140 : 100,
    stallSpeed: 62 - (refits.has('flaps') ? 12 : 0),
    ashProtection: refits.has('filter') ? 0.4 : 1,
  };
}

// One fixed step (dt seconds). input: {pitch, roll, throttleUp, throttleDown,
// flaps, brake}. weather: a WEATHER preset. Returns event strings for the game.
export function stepFlight(plane, input, weather, dt, time) {
  const events = [];
  const w = weather;

  // Throttle: Shift spools up, Ctrl spools down, mouse wheel also feeds in.
  if (input.throttleUp) plane.throttle = clamp(plane.throttle + 0.55 * dt, 0, 1);
  if (input.throttleDown) plane.throttle = clamp(plane.throttle - 0.7 * dt, 0, 1);
  if (typeof input.throttleSet === 'number') plane.throttle = clamp(input.throttleSet, 0, 1);

  // Target speed follows throttle; drag grows with the square of speed.
  const targetSpeed = plane.throttle * plane.maxSpeed;
  const accel = plane.onGround ? 26 : 14;
  plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);

  // Pitch and roll answer the stick, softened at low speed.
  const authority = clamp(plane.speed / 70, 0.25, 1);
  const targetPitch = input.pitch * 0.5 * authority;
  const targetRoll = input.roll * 0.9 * authority;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, 3.2 * dt);
  plane.roll += (targetRoll - plane.roll) * Math.min(1, 3.0 * dt);

  // A stalled wing drops the nose and stops answering.
  plane.stalled = !plane.onGround && plane.speed < plane.stallSpeed;
  if (plane.stalled) {
    plane.pitch += (-0.25 - plane.pitch) * Math.min(1, 1.5 * dt);
    if (Math.random() < dt * 0.2) events.push('stall');
  }

  // Heading follows the bank: a banked turn. The rate stays useful at low
  // speed, so the plane can tighten its turn to line up a ring.
  const turnRate = plane.roll * clamp(plane.speed / 120, 0.35, 1) * 0.6;
  plane.heading = wrapAngle(plane.heading + turnRate * dt);

  // Wind pushes the aircraft sideways and gusts shake the wings.
  const gust = Math.sin(time * 1.7) * w.gust * 0.12 + Math.sin(time * 3.1) * w.gust * 0.06;
  const windPush = (w.wind + gust) * 0.35 * dt;
  const windDir = 0.8; // prevailing sea breeze from the north-east
  plane.x += Math.sin(windDir) * windPush;
  plane.z += Math.cos(windDir) * windPush;
  plane.roll += gust * 0.012 * dt * 60 * 0.02;

  // Vertical speed: pitch times speed, nothing else — level pitch holds
  // altitude, nose up climbs, nose down descends. A stalled wing sinks.
  const vs = Math.sin(plane.pitch) * plane.speed * KNOTS_TO_MS * 196.85 * 0.8
    + (plane.stalled ? -(plane.stallSpeed - plane.speed) * 40 : 0);
  plane.verticalSpeed += (vs - plane.verticalSpeed) * Math.min(1, 2.0 * dt);

  // Move forward along the heading.
  const fwd = plane.speed * KNOTS_TO_MS * dt;
  plane.x += Math.sin(plane.heading) * fwd;
  plane.z += Math.cos(plane.heading) * fwd;
  // Wheels stay on the runway until there is flying speed and the stick
  // is pulled back: below the stall speed the wing makes no lift, so a
  // plane rolling on the strip cannot hop into the air, stall, and slam
  // back down — and a landing roll cannot bounce back up on the flare.
  const canFly = plane.speed >= plane.stallSpeed && input.pitch > 0.05;
  if (plane.onGround && !canFly) plane.verticalSpeed = 0;
  plane.y += (plane.verticalSpeed * FT_TO_M * dt) / 60;

  // Fuel burns with throttle; the tank refit stretches it.
  const burn = (0.08 + plane.throttle * 0.35) * dt * (100 / plane.fuelCapacity);
  plane.fuel = Math.max(0, plane.fuel - burn);
  if (plane.fuel <= 0 && plane.throttle > 0) {
    plane.throttle = 0;
    events.push('flameout');
  }

  // Ground handling: rolling on a strip, or scraping the sea. While the
  // wheels are down the plane is glued to the terrain — the strip slopes
  // down toward the water, so a plane that merely held its altitude
  // would be left floating above a falling runway, read as airborne,
  // stall, and slam back down. It only leaves the ground when the wing
  // can actually fly (speed above the stall speed, stick pulled back).
  const ground = terrainHeight(plane.x, plane.z);
  if (plane.onGround) {
    if (canFly && plane.verticalSpeed > 0) {
      plane.onGround = false;
    } else {
      plane.y = ground + 2;
      plane.verticalSpeed = 0;
      if (input.brake) plane.speed = Math.max(0, plane.speed - 40 * dt);
      if (plane.speed < 8) plane.speed = Math.max(0, plane.speed - 6 * dt);
      // Rolling off a strip into the sea without floats is a ditching.
      if (!overLand(plane.x, plane.z) && plane.speed > 25 && ground < 1) {
        events.push('ditching');
      }
    }
  } else if (plane.y <= ground + 2) {
    // Touchdown judgement: gentle is a landing, hard is damage.
    const hard = -plane.verticalSpeed;
    if (hard > 650) {
      plane.damage = Math.min(100, plane.damage + (hard - 650) / 22);
      events.push('hard-landing');
    } else {
      events.push('landing');
    }
    if (plane.y < ground - 2) events.push('crash');
    plane.y = ground + 2;
    plane.onGround = true;
    plane.verticalSpeed = 0;
    if (input.brake) plane.speed = Math.max(0, plane.speed - 40 * dt);
    if (plane.speed < 8) plane.speed = Math.max(0, plane.speed - 6 * dt);
    // Rolling off a strip into the sea without floats is a ditching.
    if (!overLand(plane.x, plane.z) && plane.speed > 25 && ground < 1) {
      events.push('ditching');
    }
  } else {
    plane.onGround = false;
  }

  // Terrain strike: flying into a volcano side (below the terrain surface).
  if (!plane.onGround && plane.y < ground - 2) {
    plane.damage = Math.min(100, plane.damage + 30 * dt);
    events.push('terrain');
  }

  // Ash eats the engine near an erupting peak (the ash-filter refit cuts it).
  if (w.ash > 0 && plane.y > 250) {
    plane.damage = Math.min(100, plane.damage + w.ash * 0.35 * (plane.ashProtection ?? 1) * dt);
    if (Math.random() < dt * 0.1) events.push('ash');
  }

  if (plane.damage >= 100) events.push('destroyed');
  return events;
}

export function knotsToKmh(knots) {
  return Math.round(knots * 1.852);
}

export function metresToFeet(m) {
  return Math.round(m / FT_TO_M);
}

export function headingDegrees(heading) {
  let d = (heading * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return Math.round(d);
}
