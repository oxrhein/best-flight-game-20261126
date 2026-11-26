// Nusa Airlift — renderer: sky, sea, islands, rings, runway and the aircraft.
// One clear job: everything the player sees out of the windscreen and behind
// the plane. All art is drawn with canvas paths — no image files, no network.

import { ISLANDS } from './config.js';
import { project, terrainHeight, clamp, lerp, mulberry32, stripFor } from './world.js';

const SKY_TOP = '#2f6fb4';
const SKY_MID = '#7fb6dd';
const SKY_HORIZON = '#d9ecf5';
const SEA_DEEP = '#0e4d6e';
const SEA_SHALLOW = '#2f8fae';

function skyGradient(ctx, view, weather) {
  const g = ctx.createLinearGradient(0, 0, 0, view.cy + 260);
  const dim = 1 - (1 - weather.vis) * 0.45;
  g.addColorStop(0, shade(SKY_TOP, dim));
  g.addColorStop(0.55, shade(SKY_MID, dim));
  g.addColorStop(1, shade(SKY_HORIZON, dim));
  return g;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// Draw the whole scene for one frame. cam is the plane (or a free camera);
// view holds canvas size and focal length; state carries rings, clouds, weather.
export function renderScene(ctx, cam, view, state) {
  const { weather, rings, clouds, time, nextRing, destination, mode } = state;
  ctx.clearRect(0, 0, view.w, view.h);

  // --- Sky ---
  ctx.fillStyle = skyGradient(ctx, view, weather);
  ctx.fillRect(0, 0, view.w, view.h);

  // Sun with a warm halo, fixed in the east so screenshots stay readable.
  const sunX = view.w * 0.78;
  const sunY = view.cy - 190 - cam.pitch * 120;
  const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
  halo.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  halo.addColorStop(0.25, 'rgba(255, 214, 120, 0.55)');
  halo.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, Math.PI * 2); ctx.fill();

  // --- Sea ---
  const horizonY = view.cy + cam.pitch * view.focal * 0.9;
  const sea = ctx.createLinearGradient(0, horizonY, 0, view.h);
  sea.addColorStop(0, SEA_SHALLOW);
  sea.addColorStop(0.4, '#14607f');
  sea.addColorStop(1, SEA_DEEP);
  ctx.fillStyle = sea;
  ctx.fillRect(0, Math.max(0, horizonY), view.w, view.h - Math.max(0, horizonY));

  // Sun glint on the water: a wide, low shimmer under the sun.
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#ffe9a8';
  const glintW = 260 + Math.sin(time * 0.7) * 24;
  ctx.beginPath();
  ctx.ellipse(sunX, horizonY + 40, glintW, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Motion grid on the sea: projected lines that rush past the plane.
  drawSeaGrid(ctx, cam, view, horizonY);

  // --- Clouds, far to near ---
  const sortedClouds = [...clouds].sort((a, b) => {
    const da = (a.x - cam.x) ** 2 + (a.z - cam.z) ** 2;
    const db = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2;
    return db - da;
  });
  for (const c of sortedClouds) drawCloud(ctx, cam, view, c);

  // --- Islands, far to near ---
  const sortedIslands = [...ISLANDS].sort((a, b) => {
    const da = (a.x - cam.x) ** 2 + (a.z - cam.z) ** 2;
    const db = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2;
    return db - da;
  });
  for (const isl of sortedIslands) drawIsland(ctx, cam, view, isl, time);

  // --- Destination runway, drawn on its island ---
  if (destination) drawRunway(ctx, cam, view, stripFor(destination), destination);

  // --- Sky rings: the next one glows gold, the rest are pale blue ---
  const sortedRings = [...rings].sort((a, b) => {
    const da = (a.x - cam.x) ** 2 + (a.z - cam.z) ** 2;
    const db = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2;
    return db - da;
  });
  for (const ring of sortedRings) drawRing(ctx, cam, view, ring, ring === nextRing);

  // --- Rain and ash streaks ---
  if (weather.rain > 0.1) drawRain(ctx, view, weather.rain, time);
  if (weather.ash > 0.1) drawAsh(ctx, view, weather.ash, time);

  // --- The aircraft, chase view: big, banked, propeller spinning ---
  if (mode !== 'cockpit') drawPlane(ctx, view, cam, time);
  else drawCockpitFrame(ctx, view, cam, time);
}

function drawSeaGrid(ctx, cam, view, horizonY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  const step = 400;
  // Lines running forward (constant x) and across (constant z).
  for (let gx = -6000; gx <= 18000; gx += step) {
    const p1 = project(cam, gx, 0, cam.z + 200, view);
    const p2 = project(cam, gx, 0, cam.z + 5200, view);
    if (p1 && p2) {
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }
  for (let gz = Math.floor((cam.z + 200) / step) * step; gz < cam.z + 5200; gz += step) {
    const p1 = project(cam, cam.x - 2600, 0, gz, view);
    const p2 = project(cam, cam.x + 2600, 0, gz, view);
    if (p1 && p2) {
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCloud(ctx, cam, view, c) {
  const p = project(cam, c.x, c.alt, c.z, view);
  if (!p || p.scale < 0.02) return;
  const w = c.size * p.scale;
  if (w < 4 || w > 3000) return;
  ctx.save();
  ctx.globalAlpha = 0.85 * c.shade;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, w, w * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - w * 0.45, p.y + w * 0.06, w * 0.6, w * 0.24, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + w * 0.45, p.y + w * 0.06, w * 0.6, w * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIsland(ctx, cam, view, isl, time) {
  const base = project(cam, isl.x, 0, isl.z, view);
  if (!base) return;
  const peak = project(cam, isl.x, isl.peak, isl.z, view);
  if (!peak) return;
  const halfW = isl.radius * base.scale;
  if (halfW < 2) return;
  const baseY = base.y;
  const peakY = peak.y;

  // Beach ellipse at the waterline.
  ctx.save();
  ctx.fillStyle = '#e8d9a0';
  ctx.beginPath();
  ctx.ellipse(base.x, baseY, halfW, Math.max(2, halfW * 0.16), 0, 0, Math.PI * 2);
  ctx.fill();

  // Volcano cone: green flanks, darker ravines, a cap of ash, snow or lakes.
  ctx.beginPath();
  ctx.moveTo(base.x - halfW, baseY);
  ctx.lineTo(base.x - halfW * 0.22, peakY);
  ctx.lineTo(base.x + halfW * 0.22, peakY);
  ctx.lineTo(base.x + halfW, baseY);
  ctx.closePath();
  ctx.fillStyle = isl.colour;
  ctx.fill();

  // Ravine shading down the flanks.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, halfW * 0.03);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(base.x + halfW * 0.1 * i, peakY + (baseY - peakY) * 0.15);
    ctx.lineTo(base.x + halfW * 0.28 * i, baseY);
    ctx.stroke();
  }

  // Cap: ash plume, snow, or the three coloured crater lakes.
  if (isl.cap === 'snow') {
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath();
    ctx.moveTo(base.x - halfW * 0.22, peakY);
    ctx.lineTo(base.x + halfW * 0.22, peakY);
    ctx.lineTo(base.x + halfW * 0.12, peakY + (baseY - peakY) * 0.16);
    ctx.lineTo(base.x - halfW * 0.12, peakY + (baseY - peakY) * 0.16);
    ctx.closePath(); ctx.fill();
  } else if (isl.cap === 'lakes') {
    ctx.fillStyle = '#37b6c9';
    ctx.beginPath(); ctx.ellipse(base.x - halfW * 0.07, peakY + 8, halfW * 0.07, halfW * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a13b';
    ctx.beginPath(); ctx.ellipse(base.x + halfW * 0.08, peakY + 10, halfW * 0.05, halfW * 0.025, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // Ash plume drifting from the crater.
    const drift = Math.sin(time * 0.4) * halfW * 0.15;
    ctx.fillStyle = 'rgba(120,110,100,0.55)';
    ctx.beginPath();
    ctx.ellipse(base.x + drift, peakY - halfW * 0.08, halfW * 0.3, halfW * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(base.x + drift + halfW * 0.2, peakY - halfW * 0.16, halfW * 0.2, halfW * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Island name, readable when close.
  if (halfW > 26) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${Math.max(11, Math.min(18, halfW * 0.12))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isl.name, base.x, baseY + Math.max(16, halfW * 0.2));
  }
  ctx.restore();
}

function drawRunway(ctx, cam, view, strip, island) {
  const heading = (strip.heading * Math.PI) / 180;
  const len = 520, wid = 42;
  const dx = Math.sin(heading), dz = Math.cos(heading);
  const px = Math.cos(heading), pz = -Math.sin(heading);
  const corners = [
    [strip.x - dx * len / 2 - px * wid / 2, strip.z - dz * len / 2 - pz * wid / 2],
    [strip.x + dx * len / 2 - px * wid / 2, strip.z + dz * len / 2 - pz * wid / 2],
    [strip.x + dx * len / 2 + px * wid / 2, strip.z + dz * len / 2 + pz * wid / 2],
    [strip.x - dx * len / 2 + px * wid / 2, strip.z - dz * len / 2 + pz * wid / 2],
  ];
  const pts = corners.map(([x, z]) => project(cam, x, 2, z, view));
  if (pts.some((p) => !p)) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = '#3a3f44';
  ctx.fill();
  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Centreline dashes.
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  const c1 = project(cam, strip.x - dx * len / 2, 3, strip.z - dz * len / 2, view);
  const c2 = project(cam, strip.x + dx * len / 2, 3, strip.z + dz * len / 2, view);
  if (c1 && c2) {
    ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Threshold bars and a windsock.
  const sock = project(cam, strip.x + px * 60, 30, strip.z + pz * 60, view);
  if (sock) {
    ctx.strokeStyle = '#ff5a3c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sock.x, sock.y + 18); ctx.lineTo(sock.x, sock.y); ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath(); ctx.moveTo(sock.x, sock.y); ctx.lineTo(sock.x + 16, sock.y + 4); ctx.lineTo(sock.x, sock.y + 8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawRing(ctx, cam, view, ring, isNext) {
  const p = project(cam, ring.x, ring.alt, ring.z, view);
  if (!p) return;
  const r = ring.radius * p.scale;
  if (r < 2 || r > 4000) return;
  ctx.save();
  ctx.globalAlpha = ring.passed ? 0.25 : isNext ? 1 : 0.55;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.strokeStyle = isNext ? '#ffc93c' : '#9fd8ff';
  ctx.shadowColor = isNext ? '#ffae00' : '#4db2ff';
  ctx.shadowBlur = isNext ? 22 : 8;
  ctx.beginPath();
  // A ring seen slightly from the side is an ellipse, wider than tall.
  ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = isNext ? '#ffc93c' : '#cfeeff';
  ctx.font = `700 ${Math.max(11, Math.min(20, r * 0.35))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  if (r > 14) ctx.fillText(ring.final ? 'LAND' : `RING ${ring.index + 1}`, p.x, p.y - r - 8);
  ctx.restore();
}

function drawRain(ctx, view, amount, time) {
  const rng = mulberry32(Math.floor(time * 24));
  ctx.save();
  ctx.strokeStyle = `rgba(180,210,235,${0.35 * amount})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 130 * amount; i++) {
    const x = rng() * view.w;
    const y = (rng() * view.h + time * 900) % view.h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); ctx.stroke();
  }
  ctx.restore();
}

function drawAsh(ctx, view, amount, time) {
  const rng = mulberry32(777 + Math.floor(time * 12));
  ctx.save();
  ctx.fillStyle = `rgba(90,80,70,${0.5 * amount})`;
  for (let i = 0; i < 90 * amount; i++) {
    const x = (rng() * view.w + time * 40) % view.w;
    const y = (rng() * view.h + time * 120) % view.h;
    ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The aircraft from behind and slightly above: fuselage, wings, tail, prop.
export function drawPlane(ctx, view, cam, time) {
  const cx = view.cx;
  const cy = view.h * 0.66;
  const bank = cam.roll;
  const scale = view.w / 1280;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank * 0.9);
  ctx.scale(scale, scale);

  // Propeller blur disc.
  const spin = time * 40;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#dfe8ee';
  ctx.beginPath();
  ctx.ellipse(0, -118, 10, 74, spin % Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main wings, sunset-orange with white tips.
  ctx.fillStyle = '#e86a2c';
  ctx.beginPath();
  ctx.moveTo(-150, -52); ctx.lineTo(-30, -66); ctx.lineTo(-30, -38); ctx.lineTo(-150, -30);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150, -52); ctx.lineTo(30, -66); ctx.lineTo(30, -38); ctx.lineTo(150, -30);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff3e0';
  ctx.fillRect(-150, -52, 16, 22);
  ctx.fillRect(134, -52, 16, 22);

  // Tailplane and fin.
  ctx.fillStyle = '#c94f1d';
  ctx.beginPath();
  ctx.moveTo(-58, 62); ctx.lineTo(-14, 52); ctx.lineTo(-14, 66); ctx.lineTo(-58, 74);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 62); ctx.lineTo(14, 52); ctx.lineTo(14, 66); ctx.lineTo(58, 74);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, 58); ctx.lineTo(8, 58); ctx.lineTo(6, 22); ctx.lineTo(-6, 22);
  ctx.closePath(); ctx.fill();

  // Fuselage: cream body with a teal stripe and rivet shading.
  const body = ctx.createLinearGradient(-26, 0, 26, 0);
  body.addColorStop(0, '#f7ead2');
  body.addColorStop(0.5, '#fff8ea');
  body.addColorStop(1, '#e8d3ae');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-26, -108);
  ctx.quadraticCurveTo(-34, -40, -28, 78);
  ctx.quadraticCurveTo(-16, 96, 0, 96);
  ctx.quadraticCurveTo(16, 96, 28, 78);
  ctx.quadraticCurveTo(34, -40, 26, -108);
  ctx.quadraticCurveTo(0, -122, -26, -108);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f7a8c';
  ctx.fillRect(-27, -58, 54, 12);
  ctx.fillStyle = '#12324a';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-NUSA', 0, 88);

  // Navigation lights: red left, green right, white tail strobe.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-152, -40, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#34c759';
  ctx.beginPath(); ctx.arc(152, -40, 5, 0, Math.PI * 2); ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 96, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Cockpit camera: a dashboard frame, glareshield and the nose, no airframe.
function drawCockpitFrame(ctx, view, cam, time) {
  ctx.save();
  // Glareshield across the top of the panel.
  ctx.fillStyle = '#1d2b36';
  ctx.beginPath();
  ctx.moveTo(0, view.h * 0.62);
  ctx.quadraticCurveTo(view.cx, view.h * 0.52, view.w, view.h * 0.62);
  ctx.lineTo(view.w, view.h);
  ctx.lineTo(0, view.h);
  ctx.closePath(); ctx.fill();
  // Panel: six lit dials in a row.
  const dials = [
    ['ALT', Math.round(cam.y / 0.3048)],
    ['SPD', Math.round(cam.speed)],
    ['HDG', Math.round(((cam.heading * 180) / Math.PI % 360 + 360) % 360)],
    ['VSI', Math.round(cam.verticalSpeed)],
    ['FUEL', Math.round(cam.fuel)],
    ['RPM', Math.round(1400 + cam.throttle * 1100)],
  ];
  dials.forEach(([label, value], i) => {
    const x = view.w * (0.14 + i * 0.144);
    const y = view.h * 0.8;
    const r = 46;
    ctx.fillStyle = '#0a141b';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3d5a6b';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#7dffb0';
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(value), x, y + 4);
    ctx.fillStyle = '#9fc3d4';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(label, x, y + r - 8);
    // Lit needle.
    const ang = -Math.PI * 0.75 + (Math.min(1, Math.abs(value) / 400)) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * (r - 8), y + Math.sin(ang) * (r - 8)); ctx.stroke();
  });
  // Nose cone peeking over the panel.
  ctx.fillStyle = '#f7ead2';
  ctx.beginPath();
  ctx.moveTo(view.cx - 60, view.h * 0.62);
  ctx.quadraticCurveTo(view.cx, view.h * 0.56, view.cx + 60, view.h * 0.62);
  ctx.lineTo(view.cx + 26, view.h * 0.66);
  ctx.lineTo(view.cx - 26, view.h * 0.66);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export { terrainHeight };
