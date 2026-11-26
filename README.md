# Nusa Airlift — Bush Pilot of the Volcano Isles

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/oxrhein/best-flight-game-20261126/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/oxrhein/best-flight-game-20261126/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete, original flight game for the [make.fun best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057). Fly a battered bush plane between seven volcanic Indonesian islands — through sky rings, over recognisable terrain, onto short island strips — while fuel, weather and your passengers' wishes turn every sortie into decisions.

## The game

- **Seven named legs** — Merapi Run, Bromo Hop, Rinjani Mail, Semeru Medevac, Krakatau Survey, Tambora Tour, Kelimutu Dawn — each with its own cargo, par time, pay and weather.
- **Six regulars** — Bu Ratna the jamu seller, Pak Dedi the fisherman, Sari the teacher, Pak Agus the volcano watcher, Maya the travel writer and Budi the postman. Each has a bonus request: a low pass over the lakes, a gentle ride, a fast run, a crater survey.
- **Eighteen hangar refits** — long-range tank, tuned engine, float kit, ash filter, tundra tires and more. Every refit changes how the plane flies.
- **Twenty feats** — from First Flight to Volcano Legend, stamped on the hangar wall.
- **Weather that fights back** — sea breeze, tropical rain, volcanic ash and a full storm front, with wind, gusts and visibility to match.
- **Instruments that look flown** — altitude, speed, heading, vertical speed, compass tape, artificial horizon, fuel and damage gauges, throttle lever, stall and terrain warnings.
- **Two cameras** — chase view (C) and a lit cockpit panel with six dials.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Pitch and bank |
| Shift / Ctrl | Throttle up / down (mouse wheel works too) |
| Mouse drag | Steer by dragging |
| Space | Brake on the ground |
| F | Flaps |
| C | Chase / cockpit camera |
| P | Pause · R | Restart leg · M | Mute |

Land on the destination strip after flying the rings to complete a leg. Hard landings damage cargo and airframe; running dry means gliding her in.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/index.html` and its ES modules are plain static files, and all art and sound are drawn and synthesised in code.

## Structure

- `game/index.html` — the page, one canvas
- `game/src/main.js` — game loop, screens, clicks, screenshot scenes
- `game/src/config.js` — the archipelago, legs, regulars, refits, feats, weather
- `game/src/world.js` — seeded RNG, ring chains, terrain, camera projection
- `game/src/flight.js` — the flight model: lift, stall, fuel, damage
- `game/src/render.js` — sky, sea, islands, rings, runway, the aircraft
- `game/src/hud.js` — instruments, compass, menus, briefing, hangar, debrief
- `game/src/missions.js` — leg flow, scoring, bonuses, feats, career save
- `game/src/input.js` — keyboard, mouse and the autopilot
- `game/src/audio.js` — synthesised engine, wind and chimes (WebAudio)
- `main.ts` — the make.fun hand-in program (copies `game/` + `screenshots/`, writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## Screenshots

The four screenshots in `screenshots/` are real renders of this game's own code, taken in desktop Chrome: the cover mid-flight through the rings, the takeoff roll, a storm leg, and the hangar.

## License

MIT — see [LICENSE](LICENSE).
