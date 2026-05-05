# Neon Siege Breaker

A browser-based AAA-style brick-breaking arcade game. No build step, no dependencies.

## Running

```bash
python3 server.py
# then open http://localhost:4173
```

## Controls

| Key | Action |
|---|---|
| `A` / `←` | Move paddle left |
| `D` / `→` | Move paddle right |
| `Space` | Launch ball / start game / fire laser bolts when Laser Battery is active |
| `Escape` | Restart (return to start screen) |
| `Ctrl+Shift+1–9` | **Dev:** Jump directly to wave 1–9 |
| `Ctrl+Shift+0` | **Dev:** Jump to wave 10 |
| `Ctrl+L` | **Dev:** Add 1 life |

## Brick Types

| Brick | HP | Points | Special |
|---|---|---|---|
| Standard | 1 | 100 | — |
| Armored | 2 | 220 | Fires hazard bolts; pendulum sentinel on L4+ |
| Volatile | 1 | 180 | Chain-explodes adjacent bricks on death |
| Pulse | 1 | 150 | Repels hazard bolts on death |
| Dread Core | 4 | 1200 | Unleashes a 5-bolt scatter volley on death |

## Power-up Capsules

| Capsule | Effect |
|---|---|
| **W** Fusion Bat | Expands paddle width |
| **M** Drone Split | Spawns 2 extra balls |
| **S** Time Rift | Slows hazard bolt movement for 7s |
| **B** Reflec Shield | Absorbs the next life-losing hit |
| **P** Plasma Lane | Ball pierces bricks (2× damage) for 8s |
| **+** Extra Life | +1 interceptor |
| **L** Laser Battery | Arms twin laser bolts on `Space` for 12s |
| **X** Blast Rounds | Ball hits destroy nearby bricks for 10s |
| **C** Contact Breach | Ball hits destroy touching or overlapping bricks for 10s |

## Wave Progression

Waves cycle through three grid layouts (waves → spire → rings) through wave 6. Waves 7–11 add five named late-game set pieces, and later waves return to the standard procedural rotation while movement speed continues to scale. Brick HP scales every 4 levels.

### Moving Brick System

| Wave | Movement |
|---|---|
| 1 | All static |
| 2 | ~55% of basic/pulse bricks drift independently (sinusoidal, random phase) |
| 3 | Odd-numbered rows sweep left-right as a unit |
| 4 | Armor bricks become pendulum sentinels (wide, slow oscillation) |
| 5 | Drift + row sweep simultaneously |
| 6+ | All three active; late-game waves tune drift/sweep cadence per profile |

### Late-Game Wave Set Pieces

| Wave | Theme |
|---|---|
| 7 | **Vortex Gate** — armored frame with a hollow center and pulse gate |
| 8 | **Mirror Bastion** — mirrored wings, a central spine, and a fortified bridge |
| 9 | **Skybridge** — layered support lanes with every row in motion |
| 10 | **Shatter Crown** — corner fortresses around a volatile crown core |
| 11 | **Bloom Engine** — dense crossfire lattice with the most aggressive motion mix |

Beyond wave 11, the standard procedural wave rotation resumes with the higher late-game movement cadence.

## Overdrive

Fill the Overdrive meter by scoring combos. At 100%, Overdrive auto-triggers: ball gains plasma piercing for 10s, speed cap increases, and score multiplier is boosted 1.4×.

## Siege Finale

When only 1–2 bricks remain, Siege Finale activates: remaining bricks pulse red, all live balls receive a 30% speed boost.
