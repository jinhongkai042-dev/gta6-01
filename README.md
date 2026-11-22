# Marlin Bay

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jinhongkai042-dev/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jinhongkai042-dev/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

The last ferry out of Marlin Bay is counting on Rex, a driver for hire. Take a car, get a roll of film to the docks, tail the buyer of a stolen manifest, and draw the harbor patrol away from the water. Finish all three jobs to earn $1,050. Cash, completed jobs, and your best score carry over in the same browser.

## Play

From the repository root, run `node serve.ts` with Node.js 22. Then open [Marlin Bay](http://localhost:8080/) in a desktop browser. You can also serve `game/` with any static HTTP server.

| Control | Action |
| --- | --- |
| WASD or arrow keys | Walk. In a car, accelerate, reverse, and steer. |
| E | Enter a nearby car or get out. |
| F | Punch on foot. After collecting the courier pistol, fire in the direction Rex faces. |
| Space | Handbrake. |
| P | Pause or resume. |
| M | Open or close the mission list. Use 1, 2, or 3 to choose a job. |

Get out of sight of every patrol to shed one wanted star every ten seconds. At three stars, watch the road ahead for a blockade.

## Screenshots and dossier

Open the [start](http://localhost:8080/?shot=start), [play](http://localhost:8080/?shot=play), or [end](http://localhost:8080/?shot=end) scene for a deterministic screenshot. Each URL renders one scene at 1280 × 720.

Place three or four 1280 × 720 JPEG captures in `screenshots/`, each at most 256 KiB. The first by filename is the cover. Run `MAKEFUN_OUTPUT_DIR=out node main.ts` from the root to copy the game and captures into `out/` and generate `out/dossier.json`.
