# Marlin Bay

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jinhongkai042-dev/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jinhongkai042-dev/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Rex drives for hire in a top-down coastal city. Walk to a car, take the wheel and follow the dispatch marker. A fish-market delivery pays $200, a 20-second tail pays $350, and drawing the police away from the night ferry pays $500. After the last payout, the city stays open for free roam.

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk, accelerate, reverse and steer |
| E | Enter a nearby car or get out |
| Space | Handbrake |
| F | Punch on foot, or fire the pistol after the courier rendezvous |
| P | Pause or resume |
| M | Open or close dispatch |

Police ram on contact and set roadblocks at three stars. Lose sight of every unit for ten seconds to drop a star. Cash, completed jobs and the best score are saved in the browser. Choose **Continue Save** on the title screen to pick up the next unpaid job.

## Run locally

From the repository root, run `node serve.ts` with a Node.js version that supports TypeScript directly. Open the local address it prints in a desktop browser. You can also serve `game/` as a static directory. Click **Start shift** to enable synthesized sound.

Append `?shot=start`, `?shot=play` or `?shot=end` to the game URL for the three fixed screenshot scenes.

## Build the dossier

Run `MAKEFUN_OUTPUT_DIR=out node main.ts` from the repository root to package the game and its screenshot gallery and write `out/dossier.json`.
