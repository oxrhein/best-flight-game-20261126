// Nusa Airlift — HUD and screens: instruments, compass, warnings and the
// menu, briefing, hangar and debrief screens. One clear job: what the pilot
// reads and clicks, drawn on the same canvas as the world.

import { GAME_TITLE, GAME_SUBTITLE, LEGS, REGULARS, REFITS, FEATS, formatRupiah } from './config.js';
import { metresToFeet, headingDegrees } from './flight.js';
import { clamp } from './world.js';

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.save();
  ctx.fillStyle = `rgba(8, 24, 38, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 210, 235, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, size = 11, colour = '#9fc3d4') {
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size = 20, colour = '#ffffff') {
  ctx.fillStyle = colour;
  ctx.font = `700 ${size}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

// The flight HUD: altitude, speed, heading, fuel, damage, throttle, compass,
// artificial horizon, mission line and warnings.
export function drawHUD(ctx, view, plane, game) {
  const { w, h } = view;
  const altFt = metresToFeet(plane.y);
  const hdg = headingDegrees(plane.heading);

  // Top-left instrument block.
  panel(ctx, 14, 12, 300, 92);
  label(ctx, 'ALTITUDE', 28, 32);
  value(ctx, `${altFt.toLocaleString('en-US')} ft`, 28, 58, 22, altFt < 200 && !plane.onGround ? '#ffb020' : '#ffffff');
  label(ctx, 'SPEED', 170, 32);
  value(ctx, `${Math.round(plane.speed)} kt`, 170, 58, 22, plane.stalled ? '#ff5a3c' : '#ffffff');
  label(ctx, 'HEADING', 28, 92);
  value(ctx, `${String(hdg).padStart(3, '0')}°`, 110, 92, 20);
  label(ctx, 'VSI', 200, 92);
  ctx.fillStyle = plane.verticalSpeed < -500 ? '#ffb020' : '#ffffff';
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillText(`${plane.verticalSpeed >= 0 ? '+' : ''}${Math.round(plane.verticalSpeed)}`, 245, 92);

  // Compass tape across the top centre.
  drawCompass(ctx, view, plane.heading);

  // Top-right: fuel, damage, score, rupiah.
  panel(ctx, w - 344, 12, 330, 92);
  label(ctx, 'FUEL', w - 330, 32);
  drawBar(ctx, w - 330, 40, 110, 12, plane.fuel / 100, plane.fuel < 25 ? '#ff5a3c' : '#37b6c9');
  value(ctx, `${Math.round(plane.fuel)}%`, w - 212, 54, 15);
  label(ctx, 'DAMAGE', w - 330, 76);
  drawBar(ctx, w - 330, 84, 110, 12, plane.damage / 100, '#ff7a3c');
  value(ctx, `${Math.round(plane.damage)}%`, w - 212, 96, 15);
  label(ctx, 'SCORE', w - 100, 32);
  value(ctx, `${game.score.toLocaleString('en-US')}`, w - 100, 58, 18);
  label(ctx, formatRupiah(game.rupiah), w - 100, 84, 13, '#ffd94d');

  // Artificial horizon, bottom-left.
  drawHorizon(ctx, 74, h - 74, 56, plane);

  // Throttle lever, bottom-right.
  panel(ctx, w - 120, h - 170, 106, 156);
  label(ctx, 'THROTTLE', w - 106, h - 148, 10);
  ctx.fillStyle = '#132a3d';
  ctx.fillRect(w - 76, h - 128, 18, 64);
  ctx.fillStyle = plane.throttle > 0.85 ? '#ff5a3c' : '#37b6c9';
  const th = plane.throttle;
  ctx.fillRect(w - 76, h - 128 + (1 - th) * 64 - 4, 18, 8);
  value(ctx, `${Math.round(th * 100)}%`, w - 100, h - 50, 15);
  label(ctx, plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', w - 106, h - 30, 10, '#9fc3d4');

  // Mission line, bottom centre.
  const leg = game.leg;
  const ring = game.nextRing;
  panel(ctx, w / 2 - 260, h - 56, 520, 42);
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const target = ring
    ? (ring.final ? `Final gate — land at ${game.destination.name}` : `Ring ${ring.index + 1} of ${game.rings.length} — ${Math.round(game.ringDistance)} m ahead`)
    : `Land at ${game.destination.name}`;
  ctx.fillText(`${leg.name} · ${target}`, w / 2, h - 30);
  ctx.textAlign = 'left';

  // Warnings.
  const warns = [];
  if (plane.stalled) warns.push(['STALL', '#ff5a3c']);
  if (plane.fuel < 25) warns.push(['LOW FUEL', '#ff5a3c']);
  if (plane.damage > 60) warns.push(['DAMAGE CRITICAL', '#ff5a3c']);
  if (plane.y < 120 && !plane.onGround) warns.push(['TERRAIN', '#ffb020']);
  if (game.weatherLabel) warns.push([game.weatherLabel.toUpperCase(), '#9fd8ff']);
  warns.forEach(([text, colour], i) => {
    ctx.fillStyle = colour;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${text}`, w / 2, 140 + i * 24);
    ctx.textAlign = 'left';
  });

  // Ring-passed flash.
  if (game.flash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(game.flash, 0, 1);
    ctx.fillStyle = '#ffd94d';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.flashText, w / 2, h * 0.32);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

function drawBar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = '#132a3d';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawCompass(ctx, view, heading) {
  const { w } = view;
  const cx = w / 2;
  ctx.save();
  panel(ctx, cx - 190, 12, 380, 40, 0.7);
  ctx.beginPath();
  ctx.rect(cx - 190, 12, 380, 40);
  ctx.clip();
  const points = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  const deg = headingDegrees(heading);
  for (let d = -180; d <= 180; d += 15) {
    const rel = ((d - deg + 540) % 360) - 180;
    const x = cx + rel * 2.1;
    if (x < cx - 190 || x > cx + 190) continue;
    const isCard = d % 45 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, isCard ? 40 : 32); ctx.stroke();
    const pt = points.find(([pd]) => pd === ((d % 360) + 360) % 360);
    if (pt) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt[1], x, 48);
    } else if (d % 45 === 0) {
      ctx.fillStyle = '#cfe6f2';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(((d % 360) + 360) % 360).padStart(3, '0'), x, 48);
    }
  }
  ctx.restore();
  // Centre caret.
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.moveTo(cx - 7, 12); ctx.lineTo(cx + 7, 12); ctx.lineTo(cx, 22); ctx.closePath(); ctx.fill();
}

function drawHorizon(ctx, x, y, r, plane) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch * r * 1.4, -r, r);
  // Sky above, ground below, shifted by pitch.
  ctx.fillStyle = '#4d9fd6';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx + 0);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r, pitchPx); ctx.lineTo(r, pitchPx); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x - r * 0.25, y); ctx.moveTo(x + r * 0.25, y); ctx.lineTo(x + r * 0.7, y); ctx.stroke();
  ctx.fillStyle = '#9fc3d4';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', x, y + r + 14);
  ctx.restore();
}

// --- Screens ---

export function drawTitle(ctx, view, game) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('M A K E . F U N   ·   B E S T   F L I G H T   G A M E', w / 2, h * 0.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 84px system-ui, sans-serif';
  ctx.fillText(GAME_TITLE, w / 2, h * 0.2 + 92);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillText(GAME_SUBTITLE, w / 2, h * 0.2 + 132);
  ctx.fillStyle = '#9fc3d4';
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('Seven volcanic islands. Seven named legs. One battered bush plane.', w / 2, h * 0.2 + 166);
  ctx.fillText('Fly the rings, mind the fuel, land it soft — and the regulars will pay.', w / 2, h * 0.2 + 190);

  drawButton(ctx, w / 2 - 130, h * 0.62, 260, 56, 'FLY THE FIRST LEG', true);
  drawButton(ctx, w / 2 - 130, h * 0.62 + 68, 260, 44, 'HANGAR — REFITS & FEATS', false);
  ctx.fillStyle = '#8fb4c6';
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText('Arrows / WASD — pitch & bank · Shift / Ctrl — throttle · Space — brake · F — flaps · C — camera · P — pause', w / 2, h - 48);
  ctx.fillText('Mouse steers too: hold the left button and drag. Click a button to choose.', w / 2, h - 26);
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawButton(ctx, x, y, w, h, text, primary) {
  ctx.save();
  ctx.fillStyle = primary ? '#e86a2c' : 'rgba(8, 24, 38, 0.85)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = primary ? '#ffc93c' : 'rgba(160,210,235,0.5)';
  ctx.lineWidth = primary ? 2 : 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${primary ? 18 : 14}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h / 2 + (primary ? 6 : 5));
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawBriefing(ctx, view, game) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.55)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w / 2 - 420, 60, 840, h - 160, 0.92);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('CHOOSE YOUR LEG', w / 2, 108);
  ctx.fillStyle = '#9fc3d4';
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText('Seven named routes across the archipelago — click one to brief it, then TAKE OFF.', w / 2, 132);
  ctx.textAlign = 'left';

  LEGS.forEach((leg, i) => {
    const y = 152 + i * 62;
    const selected = game.selectedLeg === i;
    const done = game.completedLegs.has(leg.id);
    ctx.save();
    if (selected) {
      ctx.fillStyle = 'rgba(232, 106, 44, 0.25)';
      ctx.beginPath(); ctx.roundRect(w / 2 - 400, y, 800, 54, 8); ctx.fill();
      ctx.strokeStyle = '#e86a2c'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = done ? '#7dffb0' : '#ffffff';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(`${done ? '✓ ' : ''}${i + 1}. ${leg.name}`, w / 2 - 384, y + 22);
    ctx.fillStyle = '#cfe6f2';
    ctx.font = '400 13px system-ui, sans-serif';
    const from = leg.from[0].toUpperCase() + leg.from.slice(1);
    ctx.fillText(`${from} → ${leg.to[0].toUpperCase() + leg.to.slice(1)} · ${leg.rings} rings · ${leg.cargo}`, w / 2 - 384, y + 42);
    ctx.fillStyle = '#ffd94d';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatRupiah(leg.pay), w / 2 + 384, y + 30);
    ctx.textAlign = 'left';
    ctx.restore();
  });

  const leg = LEGS[game.selectedLeg];
  const regular = REGULARS[game.selectedLeg % REGULARS.length];
  const y = 152 + 7 * 62 + 8;
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(`BRIEF — ${leg.name}: ${leg.brief}`, w / 2 - 400, y + 4);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText(`Passenger: ${regular.name} (${regular.job}) — ${regular.note}  Bonus ${formatRupiah(regular.bonus)}.`, w / 2 - 400, y + 26);
  ctx.fillText(`Weather: ${leg.weather} · Par time ${leg.par}s · Cargo: ${leg.cargo}`, w / 2 - 400, y + 48);
  drawButton(ctx, w / 2 - 130, y + 62, 260, 50, 'TAKE OFF  ▶', true);
  ctx.restore();
}

export function drawHangar(ctx, view, game) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.6)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, 40, 40, w - 80, h - 120, 0.94);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText('HANGAR', 64, 84);
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`Purse: ${formatRupiah(game.rupiah)}   ·   Score: ${game.score.toLocaleString('en-US')}`, 64, 110);
  ctx.fillStyle = '#9fc3d4';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText('Click a refit to buy it. Owned refits change how the plane flies.', 64, 132);

  // Refit shop: two columns of nine.
  REFITS.forEach((r, i) => {
    const col = i < 9 ? 0 : 1;
    const row = i % 9;
    const x = 64 + col * 560;
    const y = 148 + row * 44;
    const owned = game.refits.has(r.id);
    ctx.fillStyle = owned ? 'rgba(125, 255, 176, 0.14)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(x, y, 540, 38, 6); ctx.fill();
    ctx.fillStyle = owned ? '#7dffb0' : '#ffffff';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`${owned ? '✓ ' : ''}${r.name}`, x + 12, y + 16);
    ctx.fillStyle = '#cfe6f2';
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillText(r.effect, x + 12, y + 31);
    ctx.fillStyle = owned ? '#7dffb0' : '#ffd94d';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(owned ? 'OWNED' : formatRupiah(r.cost), x + 528, y + 24);
    ctx.textAlign = 'left';
  });

  // Feats strip along the bottom.
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('FEATS', 64, h - 116);
  const earned = [...game.feats].length;
  ctx.fillStyle = '#9fc3d4';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText(`${earned} of ${FEATS.length} earned — ${FEATS.filter((f) => game.feats.has(f.id)).map((f) => f.name).join(' · ') || 'none yet'}`, 140, h - 116);
  drawButton(ctx, w - 220, 56, 160, 40, 'BACK  ✕', false);
  ctx.restore();
}

export function drawDebrief(ctx, view, game) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.6)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w / 2 - 320, h / 2 - 190, 640, 380, 0.95);
  const ok = game.debrief.success;
  ctx.textAlign = 'center';
  ctx.fillStyle = ok ? '#7dffb0' : '#ff7a6b';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText(ok ? 'LEG COMPLETE' : 'SORTIE LOST', w / 2, h / 2 - 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 16px system-ui, sans-serif';
  const d = game.debrief;
  const lines = [
    `${d.legName} — ${d.reason}`,
    `Rings flown: ${d.rings}/${d.ringsTotal}   ·   Time: ${Math.round(d.time)}s (par ${d.par}s)`,
    `Fuel left: ${Math.round(d.fuel)}%   ·   Damage: ${Math.round(d.damage)}%`,
    `Leg pay: ${formatRupiah(d.pay)}   ·   Ring bonus: ${formatRupiah(d.ringBonus)}   ·   Bonus: ${formatRupiah(d.bonus)}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 100 + i * 28));
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(`Earned ${formatRupiah(d.total)}  ·  +${d.score.toLocaleString('en-US')} points`, w / 2, h / 2 + 34);
  if (d.feats.length) {
    ctx.fillStyle = '#7dffb0';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`New feats: ${d.feats.join(' · ')}`, w / 2, h / 2 + 66);
  }
  drawButton(ctx, w / 2 - 130, h / 2 + 92, 260, 50, ok ? 'NEXT LEG  ▶' : 'TRY AGAIN  ↻', true);
  drawButton(ctx, w / 2 - 130, h / 2 + 150, 260, 40, 'BACK TO MENU', false);
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, view) {
  const { w, h } = view;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 20, 32, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillStyle = '#cfe6f2';
  ctx.fillText('Press P to keep flying · R to restart the leg', w / 2, h / 2 + 24);
  ctx.restore();
  ctx.textAlign = 'left';
}
