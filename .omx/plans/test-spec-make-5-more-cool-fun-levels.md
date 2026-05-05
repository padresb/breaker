# Test Spec: Make 5 More Cool Fun Levels

## What to verify
1. **Wave generation**
   - Advancing through later levels produces five distinct new wave configurations.
   - Each new wave creates bricks without runtime errors.

2. **Progression**
   - Completing a wave still advances to the next one.
   - The new levels appear in the expected late-game range.

3. **Player-facing docs**
   - README progression section describes the new wave variants.

4. **Regression safety**
   - Existing early wave behavior remains intact.
   - Game still loads and runs in the browser after edits.

## Verification commands
- Run a quick syntax check or browser-compatible validation on `main.js`.
- If possible, run a local server and smoke-test the game in the browser.
- Inspect diffs for README consistency.
