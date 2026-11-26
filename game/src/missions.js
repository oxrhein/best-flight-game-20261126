// Nusa Airlift — missions: leg flow, ring scoring, regulars' bonuses,
// refits and feats. One clear job: what a sortie earns and remembers.

import { LEGS, REGULARS, REFITS, FEATS, formatRupiah, islandById } from './config.js';
import { buildRings, weatherFor } from './world.js';

export function newGameState() {
  return {
    screen: 'title', // title | briefing | hangar | flying | debrief | paused
    legIndex: 0,
    selectedLeg: 0,
    score: 0,
    rupiah: 0,
    ringsPassed: 0,
    ringsTotal: 0,
    completedLegs: new Set(),
    refits: new Set(),
    feats: new Set(),
    regularsFlown: new Set(),
    bestScore: 0,
    flash: 0,
    flashText: '',
    weatherLabel: '',
    debrief: null,
    leg: null,
    rings: [],
    nextRing: null,
    ringDistance: 0,
    destination: null,
    startTime: 0,
    legTime: 0,
    lowPassDone: false,
    gentleFlight: true,
    maxBank: 0,
  };
}

// Begin a leg: build its rings, place the plane on the departure strip.
export function startLeg(game, legIndex) {
  const leg = LEGS[legIndex];
  const from = islandById(leg.from);
  const to = islandById(leg.to);
  game.legIndex = legIndex;
  game.leg = { ...leg, fromIsland: from, toIsland: to };
  game.rings = buildRings(leg);
  game.ringsTotal = game.rings.length;
  game.nextRing = game.rings[0];
  game.destination = to;
  game.weatherLabel = weatherFor(leg).label;
  game.screen = 'flying';
  game.startTime = performance.now();
  game.legTime = 0;
  game.lowPassDone = false;
  game.gentleFlight = true;
  game.maxBank = 0;
  game.flash = 0;
  game.ringsPassed = 0;
  return game.leg;
}

export function regularForLeg(legIndex) {
  return REGULARS[legIndex % REGULARS.length];
}

// Called when the plane flies through a ring.
export function passRing(game, ring, plane) {
  ring.passed = true;
  game.ringsPassed += 1;
  const bonus = 2500 + Math.round(plane.speed) * 10;
  game.score += bonus;
  game.flash = 1;
  game.flashText = ring.final ? 'FINAL GATE — LAND IT!' : `RING ${ring.index + 1}  +${bonus.toLocaleString('en-US')}`;
  const idx = game.rings.indexOf(ring);
  game.nextRing = game.rings[idx + 1] || null;
  if (game.ringsPassed === 10) awardFeat(game, 'ring-10');
  return bonus;
}

// The regular's request, checked through the flight.
export function checkRegularBonus(game, plane) {
  const regular = regularForLeg(game.legIndex);
  if (!regular) return 0;
  switch (regular.request) {
    case 'lowpass':
      // Only counts once the sortie is truly under way, not on the runway.
      if (!game.lowPassDone && game.ringsPassed >= 1 && !plane.onGround && plane.y < 91 && plane.speed > 70) {
        game.lowPassDone = true;
        awardFeat(game, 'lowpass');
        return regular.bonus;
      }
      return 0;
    case 'gentle':
      if (Math.abs(plane.roll) > 0.52) game.gentleFlight = false;
      return 0;
    case 'fast':
    case 'ontime':
    case 'survey':
    case 'scenic':
    default:
      return 0;
  }
}

// Finish a leg on the destination strip: pay, bonuses, feats, debrief.
export function finishLeg(game, plane, success, reason) {
  const leg = game.leg;
  const time = (performance.now() - game.startTime) / 1000;
  const regular = regularForLeg(game.legIndex);
  let pay = 0;
  let ringBonus = game.ringsPassed * 15000;
  let bonus = 0;
  const feats = [];
  if (success) {
    pay = leg.pay;
    if (time < leg.par) {
      bonus += Math.round((leg.par - time) * 1200);
      feats.push(awardFeat(game, 'on-time'));
    }
    if (regular.request === 'gentle' && game.gentleFlight) {
      bonus += regular.bonus;
      feats.push(awardFeat(game, 'gentle'));
    }
    if (regular.request === 'lowpass' && game.lowPassDone) bonus += regular.bonus;
    if (regular.request === 'fast' && time < leg.par) bonus += regular.bonus;
    if (regular.request === 'ontime' && time < leg.par) bonus += regular.bonus;
    if (regular.request === 'scenic' && game.lowPassDone) bonus += regular.bonus;
    if (regular.request === 'survey' && game.ringsPassed === game.ringsTotal) bonus += regular.bonus;
    game.completedLegs.add(leg.id);
    game.regularsFlown.add(regular.id);
    if (game.completedLegs.size === LEGS.length) feats.push(awardFeat(game, 'seven-legs'));
    if (game.regularsFlown.size === REGULARS.length) feats.push(awardFeat(game, 'full-house'));
    if (game.ringsPassed === game.ringsTotal && plane.damage < 5 && time < leg.par) {
      feats.push(awardFeat(game, 'perfect'));
    }
    if (leg.weather === 'storm') feats.push(awardFeat(game, 'storm-rider'));
    if (leg.id === 'krakatau-survey') feats.push(awardFeat(game, 'ash-diver'));
    if (leg.id === 'kelimutu-dawn') feats.push(awardFeat(game, 'night-owl'));
    if (leg.id === 'tambora-tour' && game.lowPassDone) feats.push(awardFeat(game, 'tour-guide'));
    if (plane.damage < 5 && -plane.verticalSpeed < 150) feats.push(awardFeat(game, 'smooth'));
  } else {
    ringBonus = Math.round(ringBonus / 2);
  }
  const total = pay + ringBonus + bonus;
  const score = Math.round(total / 10) + game.ringsPassed * 2500;
  game.rupiah += total;
  game.score += score;
  if (game.rupiah >= 1000000) awardFeat(game, 'rich');
  if (score >= 100000) awardFeat(game, 'century');
  const earned = feats.filter(Boolean);
  game.debrief = {
    success, reason, legName: leg.name,
    rings: game.ringsPassed, ringsTotal: game.ringsTotal,
    time, par: leg.par, fuel: plane.fuel, damage: plane.damage,
    pay, ringBonus, bonus, total, score, feats: earned,
  };
  game.screen = 'debrief';
  return game.debrief;
}

export function awardFeat(game, id) {
  if (game.feats.has(id)) return null;
  const feat = FEATS.find((f) => f.id === id);
  if (!feat) return null;
  game.feats.add(id);
  if (game.feats.size === FEATS.length - 1) game.feats.add('legend');
  return feat.name;
}

// Buy a refit from the hangar. Returns true when the purchase lands.
export function buyRefit(game, id) {
  const refit = REFITS.find((r) => r.id === id);
  if (!refit || game.refits.has(id) || game.rupiah < refit.cost) return false;
  game.rupiah -= refit.cost;
  game.refits.add(id);
  awardFeat(game, 'mechanic');
  if (game.refits.size >= 10) awardFeat(game, 'collector');
  return true;
}

// Save/load the pilot's career between sessions (guarded: hosted pages may
// block storage, and the game must still run without it).
export function saveCareer(game) {
  try {
    const data = {
      score: game.score, rupiah: game.rupiah,
      completedLegs: [...game.completedLegs],
      refits: [...game.refits], feats: [...game.feats],
      regularsFlown: [...game.regularsFlown],
    };
    window.localStorage.setItem('nusa-airlift-career', JSON.stringify(data));
  } catch (e) { /* storage unavailable: the career lives for this session only */ }
}

export function loadCareer(game) {
  try {
    const raw = window.localStorage.getItem('nusa-airlift-career');
    if (!raw) return;
    const data = JSON.parse(raw);
    game.score = data.score || 0;
    game.rupiah = data.rupiah || 0;
    game.completedLegs = new Set(data.completedLegs || []);
    game.refits = new Set(data.refits || []);
    game.feats = new Set(data.feats || []);
    game.regularsFlown = new Set(data.regularsFlown || []);
  } catch (e) { /* a corrupt save starts a fresh career */ }
}

export { formatRupiah };
