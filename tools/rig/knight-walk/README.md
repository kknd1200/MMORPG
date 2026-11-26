# Knight walking action

Eight directions (S, SW, W, NW, N, NE, E, SE), eight unique frames per direction.
Only knight walking changes. Idle, normal attacks, skills, and the other classes
retain their existing images and sockets.

The source art was edited with image generation against the accepted knight
appearances and a foot-contact reference. The south-facing cycles were generated
separately to make alternating foot contact and knee passing readable. Background
removal, one shared scale per sheet, alignment and palette conversion are
deterministic postprocessing. No procedural replacement limbs are drawn.

`knight.webp` and `knight_female.webp` are the reviewed, transparent 160px-cell
walking sheets. `poses.json` stores explicit per-frame hand sockets. The two
`*-before.webp` files are the previous equipped-body walking pixels for comparison.
`qc.json` contains source checks and final sheet measurements.

Rebuild only this action with `python tools/rig/compile_knight_walk.py`.
The full equipment rig compiler also reapplies this action after its base pass.
Review `/tools/knight-walk-review.html` while the game server is running.
