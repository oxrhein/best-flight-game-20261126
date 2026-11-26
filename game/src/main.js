// Nusa Airlift — main: the game loop, screens, clicks and screenshot scenes.
// One clear job: run the game. It wires input, flight, rendering and HUD
// together and owns the state machine between title, briefing, hangar,
// flying, debrief and pause.

import { LEGS, REGULARS, REFITS, WEATHER, islandById } from './config.js';
import { buildClouds, weatherFor, clamp, stripFor } from './world.js';
import { newPlane, stepFlight } from './flight.js';
import { renderScene } from './render.js';
import {
  drawHUD, drawTitle, drawBriefing, drawHangar, drawDebrief, drawPaused,
} from './hud.js';
import { createInput, autopilot } from './input.js';
import { createAudio } from './audio.js';
import {
  newGameState, startLeg, passRing, checkRegularBonus, finishLeg,
  buyRefit, saveCareer, loadCareer, awardFeat,
} from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { w: 1280, h: 800, cx: 640, cy: 400, focal: 720 };

const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot'); // cover | takeoff | storm | hangar
const autoDemo = params.get('auto') === '1' || shotScene !== null;

const game = newGameState();
loadCareer(game);
const input = createInput();
const audio = createAudio();
const clouds = buildClouds(20261126);

let plane = null;
let cameraMode = 'chase'; // chase | cockpit
let time = 0;
let lastTs = 0;
let demoIdle = 0;

function resize() {
  const scale = Math.min(window.innerWidth / view.w, window.innerHeight / view.h);
  canvas.style.width = `${view.w * scale}px`;
  canvas.style.height = `${view.h * scale}px`;
}
window.addEventListener('resize', resize);
resize();

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * view.w,
    y: ((clientY - rect.top) / rect.height) * view.h,
  };
}

function hit(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// --- Screenshot scenes: deterministic setups, rendered by the game's own
// code, so each screenshot is a real frame of the game in flight.
function applyShotScene() {
  if (shotScene === 'hangar') {
    game.rupiah = 850000;
    game.score = 124500;
    game.refits = new Set(['tank', 'engine', 'floats', 'flaps', 'radio', 'lights']);
    game.feats = new Set(['first-flight', 'ring-10', 'smooth', 'on-time']);
    game.screen = 'hangar';
    return;
  }
  const legIndex = shotScene === 'storm' ? 6 : 0;
  const leg = startLeg(game, legIndex);
  plane = newPlane(leg, game.refits);
  if (shotScene === 'takeoff') {
    plane.throttle = 0.85;
    plane.speed = 62;
    plane.y = 8;
    game.score = 0;
    game.rupiah = 0;
  } else {
    // Mid-flight: two rings already flown, the next ring dead ahead.
    game.rings[0].passed = true;
    game.rings[1].passed = true;
    game.ringsPassed = 2;
    game.nextRing = game.rings[2];
    const ring = game.nextRing;
    const dx = ring.x - plane.x;
    const dz = ring.z - plane.z;
    const dist = Math.hypot(dx, dz);
    const back = 900;
    plane.x = ring.x - (dx / dist) * back;
    plane.z = ring.z - (dz / dist) * back;
    plane.y = ring.alt - 40;
    plane.heading = Math.atan2(dx, dz);
    plane.speed = 128;
    plane.throttle = 0.72;
    plane.onGround = false;
    game.score = 18250;
    game.rupiah = 340000;
  }
  game.screen = 'flying';
}

function beginLeg(index) {
  const leg = startLeg(game, index);
  plane = newPlane(leg, game.refits);
  audio.unlock();
}

function endLeg(success, reason) {
  finishLeg(game, plane, success, reason);
  if (success) audio.fanfare();
  else audio.crash();
  saveCareer(game);
}

// --- Per-frame update while flying ---
function updateFlying(dt) {
  // Autopilot for the demo and screenshot scenes; the player otherwise.
  let drive = input;
  if (autoDemo && game.screen === 'flying') {
    // Line-following autopilot: it tracks the route line from the previous
    // ring (or the departure strip) through the next ring, so the approach
    // flies through the ring instead of orbiting around it. Once the final
    // gate is flown, it lines up the landing on the destination strip.
    const ring = game.nextRing;
    let prev = null;
    if (ring) {
      const idx = game.rings.indexOf(ring);
      prev = idx > 0
        ? game.rings[idx - 1]
        : { x: stripFor(game.leg.fromIsland).x, z: stripFor(game.leg.fromIsland).z, alt: 150 };
      drive = autopilot(plane, ring, dt, prev);
    } else {
      const gate = game.rings[game.rings.length - 1];
      const strip = stripFor(game.destination);
      drive = autopilot(plane, { x: strip.x, z: strip.z, alt: 25, landing: true }, dt, gate);
    }
    if (plane.onGround && plane.speed < 5) drive.throttleUp = true;
  } else {
    input.applyMouseSteer(view);
    if (input.wheelDelta) {
      plane.throttle = clamp(plane.throttle + input.wheelDelta * 0.0004, 0, 1);
      input.wheelDelta = 0;
    }
  }
  if (typeof drive.pitch === 'number') {
    // Autopilot and keyboard both write pitch/roll on the drive object;
    // stepFlight reads them directly, nothing to copy here.
  }
  const weather = weatherFor(game.leg);
  const events = stepFlight(plane, drive, weather, dt, time);

  // Ring passes: the plane has to fly through the hoop, not just near it
  // in the sky — horizontal distance inside the ring, and altitude within
  // a generous band, because the autopilot (and a player) may clear the
  // terrain below by more than the ring's own altitude over a volcano.
  const ring = game.nextRing;
  if (ring) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.alt;
    const dz = plane.z - ring.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    game.ringDistance = horizontal;
    if (horizontal < ring.radius * 1.5 && Math.abs(dy) < 120) {
      passRing(game, ring, plane);
      audio.ring();
    }
  }

  // The regular's bonus request, watched through the flight.
  const bonus = checkRegularBonus(game, plane);
  if (bonus > 0) {
    game.score += bonus;
    game.flash = 1;
    game.flashText = `REGULAR'S WISH GRANTED  +${bonus.toLocaleString('en-US')}`;
    audio.fanfare();
  }

  // Banking too hard on a gentle flight costs the medevac bonus.
  game.maxBank = Math.max(game.maxBank, Math.abs(plane.roll));

  // Landing: on the destination strip, slow, rings flown.
  const dest = stripFor(game.destination);
  const dDest = Math.hypot(plane.x - dest.x, plane.z - dest.z);
  if (plane.onGround && plane.speed < 45 && dDest < 420 && game.ringsPassed >= 1) {
    endLeg(true, plane.damage > 40 ? 'Landed, but the cargo took a beating' : 'Wheels down, cargo safe');
    return;
  }
  // Landed out: slow on the ground far from any strip.
  if (plane.onGround && plane.speed < 8 && dDest > 900 && time - game.startTime > 5000) {
    endLeg(false, 'Landed out in the bush — the rescue boat is coming');
    return;
  }
  // Events from the flight model.
  for (const ev of events) {
    if (ev === 'crash' || ev === 'destroyed' || ev === 'ditching') {
      endLeg(false, ev === 'ditching' ? 'Ditched in the sea' : ev === 'destroyed' ? 'The plane came apart' : 'Flew into the mountainside');
      return;
    }
    if (ev === 'hard-landing') {
      audio.thud();
      game.flash = 1;
      game.flashText = 'HARD LANDING!';
    }
    if (ev === 'landing') audio.thud();
    if (ev === 'flameout') {
      game.flash = 1;
      game.flashText = 'OUT OF FUEL — GLIDE HER IN';
    }
  }

  game.flash = Math.max(0, game.flash - dt * 0.9);
  game.legTime = (performance.now() - game.startTime) / 1000;
  audio.update(plane.throttle, plane.speed, plane.onGround);

  // Clouds drift with the wind.
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > 12500) c.x = -500;
  }
}

// --- Clicks, per screen ---
function handleClick(p) {
  audio.unlock();
  audio.click();
  const { w, h } = view;
  if (game.screen === 'title') {
    if (hit(p.x, p.y, w / 2 - 130, h * 0.62, 260, 56)) {
      game.screen = 'briefing';
    } else if (hit(p.x, p.y, w / 2 - 130, h * 0.62 + 68, 260, 44)) {
      game.screen = 'hangar';
    }
    return;
  }
  if (game.screen === 'briefing') {
    LEGS.forEach((leg, i) => {
      if (hit(p.x, p.y, w / 2 - 400, 152 + i * 62, 800, 54)) game.selectedLeg = i;
    });
    const y = 152 + 7 * 62 + 8;
    if (hit(p.x, p.y, w / 2 - 130, y + 62, 260, 50)) beginLeg(game.selectedLeg);
    return;
  }
  if (game.screen === 'hangar') {
    if (hit(p.x, p.y, w - 220, 56, 160, 40)) {
      game.screen = 'title';
      return;
    }
    REFITS.forEach((r, i) => {
      const col = i < 9 ? 0 : 1;
      const row = i % 9;
      const x = 64 + col * 560;
      const y = 148 + row * 44;
      if (hit(p.x, p.y, x, y, 540, 38)) {
        if (buyRefit(game, r.id)) { audio.ring(); saveCareer(game); }
      }
    });
    return;
  }
  if (game.screen === 'debrief') {
    if (hit(p.x, p.y, w / 2 - 130, h / 2 + 92, 260, 50)) {
      if (game.debrief.success) {
        game.selectedLeg = (game.legIndex + 1) % LEGS.length;
        game.screen = 'briefing';
      } else {
        beginLeg(game.legIndex);
      }
    } else if (hit(p.x, p.y, w / 2 - 130, h / 2 + 150, 260, 40)) {
      game.screen = 'title';
    }
  }
}

function handleKeys(keys) {
  for (const k of keys) {
    if (k === 'p' && (game.screen === 'flying' || game.screen === 'paused')) {
      game.screen = game.screen === 'flying' ? 'paused' : 'flying';
    }
    if (k === 'r' && game.screen === 'flying') beginLeg(game.legIndex);
    if (k === 'c' && game.screen === 'flying') {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    }
    if (k === 'm') audio.setMuted(!audio.isMuted());
    if (k === 'escape') game.screen = 'title';
    if (k === 'f' && game.screen === 'flying') plane.flaps = !plane.flaps;
  }
}

// --- Render one frame ---
function render() {
  const { w, h } = view;
  if (game.screen === 'flying' || game.screen === 'paused') {
    const cam = {
      x: plane.x, y: plane.y + 6, z: plane.z,
      heading: plane.heading, pitch: plane.pitch * 0.55, roll: plane.roll,
      speed: plane.speed, throttle: plane.throttle, fuel: plane.fuel,
      verticalSpeed: plane.verticalSpeed,
    };
    renderScene(ctx, cam, view, {
      weather: weatherFor(game.leg),
      rings: game.rings,
      clouds,
      time,
      nextRing: game.nextRing,
      destination: game.destination,
      mode: cameraMode,
    });
    drawHUD(ctx, view, plane, game);
    if (game.screen === 'paused') drawPaused(ctx, view);
    return;
  }

  // Menu screens still show the world behind them: a parked plane on the
  // Merapi strip at dawn, so the title is a screenshot of the game itself.
  // The camera sits behind the strip, looking back at the volcano.
  const merapiStrip = stripFor(islandById('merapi'));
  const parkCam = {
    x: merapiStrip.x, y: 26, z: merapiStrip.z - 260, heading: 2.9, pitch: 0.02,
    speed: 0, throttle: 0, fuel: 100, verticalSpeed: 0,
  };
  renderScene(ctx, parkCam, view, {
    weather: WEATHER.clear,
    rings: [],
    clouds,
    time,
    nextRing: null,
    destination: islandById('merapi'),
    mode: 'chase',
  });
  if (game.screen === 'title') drawTitle(ctx, view, game);
  else if (game.screen === 'briefing') drawBriefing(ctx, view, game);
  else if (game.screen === 'hangar') drawHangar(ctx, view, game);
  else if (game.screen === 'debrief') drawDebrief(ctx, view, game);
}

// --- The loop ---
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  time += dt;

  const click = input.consumeClick();
  if (click) handleClick(toCanvasCoords(click.x, click.y));
  handleKeys(input.consumeKeys());

  if (game.screen === 'flying') updateFlying(dt);
  if (game.screen === 'title' && autoDemo) {
    // Attract mode: after 20 idle seconds, fly the first leg by itself.
    demoIdle += dt;
    if (demoIdle > 20) beginLeg(0);
  } else {
    demoIdle = 0;
  }

  render();
  requestAnimationFrame(frame);
}

// First flight feat for taking off at all.
const firstTakeoff = setInterval(() => {
  if (plane && !plane.onGround && plane.speed > 70) {
    awardFeat(game, 'first-flight');
    clearInterval(firstTakeoff);
  }
}, 500);

if (shotScene) applyShotScene();
requestAnimationFrame(frame);
