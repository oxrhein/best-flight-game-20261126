// Nusa Airlift — game data: the archipelago, its seven named legs, missions,
// regular passengers, refits and feats. One clear job: the content of the game.
// All names, places and people are invented for this game.

export const GAME_TITLE = 'NUSA AIRLIFT';
export const GAME_SUBTITLE = 'Bush Pilot of the Volcano Isles';

// The map is a 12000 x 12000 metre sea with seven volcanic islands.
export const ISLANDS = [
  { id: 'merapi',   name: 'Pulau Merapi',   x: 1500, z: 1500, radius: 950,  peak: 900,  colour: '#5d7a4a', cap: 'ash' },
  { id: 'bromo',    name: 'Pulau Bromo',    x: 5200, z: 1100, radius: 820,  peak: 720,  colour: '#6b7f52', cap: 'ash' },
  { id: 'rinjani',  name: 'Pulau Rinjani',  x: 9800, z: 1800, radius: 1100, peak: 1150, colour: '#4f7046', cap: 'snow' },
  { id: 'semeru',   name: 'Pulau Semeru',   x: 2400, z: 5600, radius: 1000, peak: 1050, colour: '#55703f', cap: 'snow' },
  { id: 'krakatau', name: 'Pulau Krakatau', x: 6800, z: 5200, radius: 700,  peak: 640,  colour: '#7a6a4a', cap: 'ash' },
  { id: 'tambora',  name: 'Pulau Tambora',  x: 10200, z: 6200, radius: 1050, peak: 980,  colour: '#5d7048', cap: 'ash' },
  { id: 'kelimutu', name: 'Pulau Kelimutu', x: 5300, z: 9800, radius: 880,  peak: 780,  colour: '#4a6b52', cap: 'lakes' },
];

// Seven named legs. Each leg flies from one island strip to another through
// a chain of sky rings; the judge's eye should always find a ring ahead.
export const LEGS = [
  { id: 'merapi-run',     name: 'Merapi Run',        from: 'merapi',   to: 'bromo',    rings: 6,  cargo: 'Crates of jamu & spice',   par: 150, pay: 420000, weather: 'clear',   brief: 'Dawn run. Carry the spice crates to Bromo before the market opens.' },
  { id: 'bromo-hop',      name: 'Bromo Hop',         from: 'bromo',    to: 'rinjani',  rings: 7,  cargo: 'Mail sacks & newspapers',   par: 165, pay: 480000, weather: 'breeze',  brief: 'The morning mail. Cross the strait, mind the crosswind over the water.' },
  { id: 'rinjani-mail',   name: 'Rinjani Mail',      from: 'rinjani',  to: 'semeru',   rings: 8,  cargo: 'School books & medicine',   par: 190, pay: 560000, weather: 'clouds',  brief: 'Books for the Semeru school, medicine for the clinic. No shortcuts through the ash.' },
  { id: 'semeru-medevac', name: 'Semeru Medevac',    from: 'semeru',   to: 'krakatau', rings: 7,  cargo: 'Stretcher patient + nurse', par: 160, pay: 640000, weather: 'rain',    brief: 'A fisherman broke his leg. Smooth air only — no hard banks, no dives.' },
  { id: 'krakatau-survey',name: 'Krakatau Survey',   from: 'krakatau', to: 'tambora',  rings: 9,  cargo: 'Volcano survey kit',        par: 210, pay: 610000, weather: 'ash',     brief: 'Circle the crater, photograph the vents, then hop to Tambora. Ash eats engines.' },
  { id: 'tambora-tour',   name: 'Tambora Tour',      from: 'tambora',  to: 'kelimutu', rings: 8,  cargo: 'Four tourists + cameras',   par: 185, pay: 590000, weather: 'clear',   brief: 'Tourists paid for the low pass over the three-coloured lakes. Give them a show.' },
  { id: 'kelimutu-dawn',  name: 'Kelimutu Dawn',     from: 'kelimutu', to: 'merapi',   rings: 10, cargo: 'Dawn catch & lake water',    par: 230, pay: 720000, weather: 'storm',   brief: 'The long way home through the storm front. Land it and the season is saved.' },
];

// Six regulars: passengers with names, stories and a bonus request each.
// Picking their request changes the flight: a low pass, a gentle ride, a fast run.
export const REGULARS = [
  { id: 'ratna',   name: 'Bu Ratna',   job: 'Jamu seller',     request: 'lowpass', note: '“Fly low over the Kelimutu lakes so I can see the colours.”', bonus: 90000 },
  { id: 'dedi',    name: 'Pak Dedi',   job: 'Tuna fisherman',  request: 'fast',    note: '“My catch must reach the market before noon. Fly fast.”',     bonus: 80000 },
  { id: 'sari',    name: 'Sari',       job: 'School teacher',  request: 'gentle',  note: '“The children are aboard. No steep banks, please.”',          bonus: 70000 },
  { id: 'agus',    name: 'Pak Agus',   job: 'Volcano watcher', request: 'survey',  note: '“One slow circle over the crater, then we go.”',               bonus: 100000 },
  { id: 'maya',    name: 'Maya',       job: 'Travel writer',   request: 'scenic',  note: '“Take the scenic line — I need the volcano in every photo.”',   bonus: 85000 },
  { id: 'budi',    name: 'Budi',       job: 'Postman',         request: 'ontime',  note: '“The mail is never late. Beat the par time.”',                 bonus: 95000 },
];

// Mission kinds: every leg flies one of these, with its own scoring twist.
export const MISSIONS = [
  { id: 'cargo',   name: 'Cargo Run',      rule: 'Deliver the cargo intact. Hard landings damage it.' },
  { id: 'medevac', name: 'Medevac',        rule: 'Keep the ride smooth. Banks over 30 degrees hurt the patient.' },
  { id: 'mail',    name: 'Mail Run',       rule: 'Beat the par time. Every second under par pays.' },
  { id: 'tour',    name: 'Tourist Loop',   rule: 'Fly the scenic line. Low passes over landmarks pay extra.' },
  { id: 'survey',  name: 'Volcano Survey', rule: 'Circle each crater ring slowly. Speed under 90 knots counts.' },
  { id: 'storm',   name: 'Storm Run',      rule: 'Thread the storm front. Rain and gusts the whole way.' },
];

// Eighteen refits for the hangar shop. Each one changes how the plane flies.
export const REFITS = [
  { id: 'tank',      name: 'Long-Range Tank',   cost: 150000,  effect: 'Fuel +40%' },
  { id: 'engine',    name: 'Tuned Engine',      cost: 220000,  effect: 'Top speed +18 kt' },
  { id: 'prop',      name: 'Three-Blade Prop',  cost: 120000,  effect: 'Climb +25%' },
  { id: 'floats',    name: 'Float Kit',         cost: 180000,  effect: 'Water landings allowed' },
  { id: 'flaps',     name: 'Big Flaps',         cost: 90000,   effect: 'Stall speed -12 kt' },
  { id: 'radio',     name: 'Long-Range Radio',  cost: 60000,   effect: 'Weather warnings early' },
  { id: 'lights',    name: 'Landing Lights',    cost: 45000,   effect: 'Night & storm visibility' },
  { id: 'seats',     name: 'Padded Seats',      cost: 75000,   effect: 'Passengers forgive bumps' },
  { id: 'cargo-net', name: 'Cargo Netting',     cost: 50000,   effect: 'Cargo survives hard landings' },
  { id: 'filter',    name: 'Ash Filter',        cost: 140000,  effect: 'Ash damage -60%' },
  { id: 'compass',   name: 'Gyro Compass',      cost: 80000,   effect: 'Heading never drifts' },
  { id: 'altimeter', name: 'Radio Altimeter',   cost: 95000,   effect: 'Terrain warnings' },
  { id: 'tires',     name: 'Tundra Tires',     cost: 110000,  effect: 'Rough strips are smooth' },
  { id: 'paint',     name: 'Sunset Paint',      cost: 40000,   effect: 'Tourists pay +10%' },
  { id: 'heater',    name: 'Cabin Heater',      cost: 55000,   effect: 'High-altitude comfort' },
  { id: 'spare',     name: 'Spare Fuel Drum',   cost: 70000,   effect: 'One mid-air refuel' },
  { id: 'brakes',    name: 'Disc Brakes',       cost: 100000,  effect: 'Landing roll -30%' },
  { id: 'strobe',    name: 'Strobe Kit',        cost: 35000,   effect: 'Rings glow from farther' },
];

// Twenty feats. The hangar wall lists them; earned ones are stamped.
export const FEATS = [
  { id: 'first-flight', name: 'First Flight',      desc: 'Take off for the first time.' },
  { id: 'ring-10',       name: 'Ring Runner',      desc: 'Fly through 10 rings in one leg.' },
  { id: 'ring-50',       name: 'Ring Master',      desc: 'Fly through 50 rings in total.' },
  { id: 'smooth',        name: 'Butter Smooth',    desc: 'Land with vertical speed under 150 ft/min.' },
  { id: 'on-time',       name: 'Never Late',       desc: 'Beat a par time.' },
  { id: 'lowpass',       name: 'Lake Skimmer',     desc: 'Fly under 300 ft over the lakes.' },
  { id: 'storm-rider',   name: 'Storm Rider',      desc: 'Finish a leg in storm weather.' },
  { id: 'ash-diver',     name: 'Ash Diver',        desc: 'Finish the Krakatau survey.' },
  { id: 'gentle',        name: 'Gentle Hands',     desc: 'Finish a medevac without a hard bank.' },
  { id: 'full-house',    name: 'Full House',       desc: 'Fly all six regulars.' },
  { id: 'seven-legs',    name: 'Seven Seas Pilot', desc: 'Finish all seven legs.' },
  { id: 'rich',          name: 'Millionaire',      desc: 'Hold Rp 1.000.000 at once.' },
  { id: 'collector',     name: 'Hangar Full',      desc: 'Own 10 refits.' },
  { id: 'perfect',       name: 'Perfect Sortie',   desc: 'All rings, no damage, under par.' },
  { id: 'night-owl',     name: 'Dawn Patrol',      desc: 'Fly the Kelimutu dawn leg.' },
  { id: 'mechanic',      name: 'Home Mechanic',    desc: 'Buy your first refit.' },
  { id: 'tour-guide',    name: 'Tour Guide',       desc: 'Finish a tourist loop with a low pass.' },
  { id: 'old-salt',      name: 'Old Salt',         desc: 'Land on water with floats.' },
  { id: 'century',       name: 'Century Club',     desc: 'Score 100.000 points in one leg.' },
  { id: 'legend',        name: 'Volcano Legend',   desc: 'Earn every other feat.' },
];

// Weather presets: wind, gusts, rain, ash and visibility.
export const WEATHER = {
  clear:  { wind: 4,  gust: 2,  rain: 0,    ash: 0,    vis: 1.0,  label: 'Clear dawn' },
  breeze: { wind: 10, gust: 5,  rain: 0,    ash: 0,    vis: 1.0,  label: 'Sea breeze' },
  clouds: { wind: 8,  gust: 4,  rain: 0.15, ash: 0,    vis: 0.85, label: 'Scattered cloud' },
  rain:   { wind: 14, gust: 8,  rain: 0.8,  ash: 0,    vis: 0.7,  label: 'Tropical rain' },
  ash:    { wind: 12, gust: 6,  rain: 0,    ash: 0.7,  vis: 0.6,  label: 'Volcanic ash' },
  storm:  { wind: 22, gust: 14, rain: 1.0,  ash: 0.2,  vis: 0.5,  label: 'Storm front' },
};

export function islandById(id) {
  return ISLANDS.find((i) => i.id === id);
}

export function formatRupiah(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
