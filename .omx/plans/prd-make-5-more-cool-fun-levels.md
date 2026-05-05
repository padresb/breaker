# PRD: Make 5 More Cool Fun Levels

## Goal
Add five distinct late-game wave variants that make progression feel more surprising and fun while preserving the existing arcade flow.

## User story
As a player, I want later waves to introduce new patterns and behaviors so that the game stays fresh and escalates in a satisfying way.

## Scope
- Add five new wave variants for later levels.
- Make the new waves visually and mechanically distinct from the current baseline.
- Keep level generation deterministic enough to remain readable and balanced.
- Update player-facing docs if the wave set changes.

## Non-goals
- No new assets or dependencies.
- No full rewrite of the combat or scoring systems.
- No multiplayer, menus, or save system changes.

## Proposed experience
The first six waves remain the current tutorial/progression arc. Five additional waves introduce escalating gimmicks such as denser formations, mirrored layouts, shifting brick lanes, fortress-style pockets, and endgame pressure waves.

## Acceptance criteria
- Five additional wave variants are implemented in game logic.
- They are reachable through normal progression after the existing early waves.
- Gameplay remains stable: ball launch, brick destruction, and wave transitions still work.
- README progression notes reflect the new wave set.
- Verification passes after implementation.
