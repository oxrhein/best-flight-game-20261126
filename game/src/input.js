// Nusa Airlift — input: keyboard and mouse, with a small autopilot used by
// the demo and by screenshot scenes. One clear job: what the pilot asks for.

export function createInput() {
  const keys = new Set();
  const input = {
    pitch: 0, // -1 nose down .. +1 nose up (stick)
    roll: 0, // -1 left .. +1 right
    throttleUp: false,
    throttleDown: false,
    throttleSet: null,
    flaps: false,
    brake: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    clicked: null, // {x, y} consumed by the game each frame
    pressedKeys: new Set(),
  };

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys.has(k)) input.pressedKeys.add(k);
    keys.add(k);
    refresh();
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
    refresh();
  }
  function refresh() {
    const up = keys.has('arrowup') || keys.has('w');
    const down = keys.has('arrowdown') || keys.has('s');
    const left = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    input.pitch = (up ? 1 : 0) + (down ? -1 : 0);
    input.roll = (right ? 1 : 0) + (left ? -1 : 0);
    input.throttleUp = keys.has('shift');
    input.throttleDown = keys.has('control');
    input.brake = keys.has(' ');
    input.flaps = keys.has('f');
  }
  function onMouseDown(e) {
    input.mouseSteer = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    input.clicked = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e) {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  }
  function onMouseUp() { input.mouseSteer = false; }
  function onWheel(e) {
    e.preventDefault();
    input.throttleSet = null;
    input.wheelDelta = (input.wheelDelta || 0) - e.deltaY;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: false });

  input.consumeClick = function () {
    const c = input.clicked;
    input.clicked = null;
    return c;
  };
  input.consumeKeys = function () {
    const k = input.pressedKeys;
    input.pressedKeys = new Set();
    return k;
  };
  // Mouse steering: drag left/right to bank, up/down to pitch.
  input.applyMouseSteer = function (view) {
    if (!input.mouseSteer) return;
    const dx = (input.mouseX - view.w / 2) / (view.w / 2);
    const dy = (input.mouseY - view.h / 2) / (view.h / 2);
    input.roll = Math.max(-1, Math.min(1, dx * 1.4));
    input.pitch = Math.max(-1, Math.min(1, -dy * 1.2));
  };
  return input;
}

// A gentle autopilot: follows the route line from `prev` through `target`
// (the next ring), steering back onto the line when it drifts off, so the
// approach flies through the ring instead of orbiting around it. Used for
// the demo and for deterministic screenshots.
import { terrainHeight } from './world.js';

export function autopilot(plane, target, dt, prev) {
  const out = { pitch: 0, roll: 0, throttleUp: false, throttleDown: false, brake: false, flaps: false };
  if (!target) return out;
  let wantHeading;
  const distToRing = Math.hypot(target.x - plane.x, target.z - plane.z);
  if (prev && distToRing > 700) {
    // Far out: follow the route line from prev through target, steering
    // back onto the line when the plane drifts sideways.
    const dx = target.x - prev.x;
    const dz = target.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len, dirZ = dz / len;
    const relX = plane.x - prev.x;
    const relZ = plane.z - prev.z;
    const crossTrack = relX * dirZ - relZ * dirX; // +ve: right of the line
    const lineHeading = Math.atan2(dirX, dirZ);
    wantHeading = lineHeading - Math.max(-0.6, Math.min(0.6, crossTrack * 0.0012));
  } else {
    // Close in: pure pursuit of the ring itself, so a miss turns back
    // toward it instead of flying on down the line.
    wantHeading = Math.atan2(target.x - plane.x, target.z - plane.z);
  }
  let dh = wantHeading - plane.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  out.roll = Math.max(-0.7, Math.min(0.7, dh * 1.2));
  // Never fly into the ground on the way to a ring: the altitude target
  // is at least 100 m above whatever terrain is underneath right now, so
  // a descending leg between two rings still clears the peaks. Landing
  // is exempt — the final approach has to come down to the beach strip.
  const safeAlt = target.landing
    ? target.alt
    : Math.max(target.alt, terrainHeight(plane.x, plane.z) + 100);
  const altErr = safeAlt - plane.y;
  // Hold a cruise near 125 kt, and slow right down near the ring so the
  // turn radius shrinks and the approach stays on the route line.
  const dist = Math.hypot(target.x - plane.x, target.z - plane.z);
  if (target.landing) {
    // Landing: hold approach speed, cut power only on short final, brake
    // on the roll. Never let the throttle die far out — a stalled plane
    // cannot land.
    if (plane.onGround) {
      out.throttleUp = false;
      out.throttleDown = true;
      out.brake = true;
      out.pitch = 0;
    } else {
      // Hold approach speed; cut power only on short final when already
      // low, and never let the speed die far out — a stalled plane
      // cannot land.
      out.throttleUp = plane.speed < 78 || plane.stalled;
      out.throttleDown = plane.speed > 92 || (dist < 80 && plane.y < 15);
      out.brake = false;
      // Glide path: the target altitude falls with the distance to the
      // strip, so the plane descends steadily onto the runway instead of
      // levelling off at 25 m, porpoising on the flare, stalling, and
      // slamming down. Near the ground, hold level and let it settle.
      const glideAlt = Math.max(8, dist * 0.06);
      out.pitch = plane.y < 10 ? 0 : Math.max(-0.8, Math.min(0.15, (glideAlt - plane.y) * 0.008));
    }
  } else {
    out.pitch = Math.max(-0.7, Math.min(0.7, altErr * 0.006));
    const cruise = dist < 700 ? 85 : 125;
    out.throttleUp = plane.speed < cruise;
    out.throttleDown = plane.speed > cruise + 20;
  }
  // On the takeoff roll, rotate: pitch up once the wheels are rolling so
  // the plane lifts off instead of running off the end of the strip. This
  // must not fire on the landing roll — pitching up there at 15 kt would
  // lift the plane back into the air, stall it, and slam it down again.
  if (!target.landing && plane.onGround && plane.speed < 90) out.pitch = 0.35;
  return out;
}
