# Mage and priest walking actions

Four appearances: `mage_male`, `mage`, `priest`, `priest_female`. Each uses eight
directions (S, SW, W, NW, N, NE, E, SE) and eight sequential walking frames.
The identity references are the existing purple/gold mages and ivory/gold priests.
Walking retains the long robes while adding alternating boot contacts, fold/hem
movement, restrained torso motion and stable equipment-carrying hands.

Artwork originates from image generation. Each appearance has its own directional
sheet; front cycles were authored separately. Two male raw sheets had unequal
cell spacing. Their 64 complete connected sprites were translated, without
resizing or repainting, into equal cells before strict processing. Source bounds
and processing reports are recorded in `qc.json`. Every final source passes
empty-frame, clipping, scale variation and anchor checks. The original generated
images remain intact.

Deterministic processing removes magenta, uses a shared scale per source sheet,
aligns feet and matches the existing palette. Purple robe colors are retained.
The body sheets contain empty carry hands; actual staff, orb and scripture icons
are drawn using the explicit per-frame sockets in `poses.json`.

The four character `.webp` files are the reviewed 160px-cell walking sheets.
`*-before.webp` preserves the previous walking body for comparison. Rebuild with
`python tools/rig/compile_caster_walk.py` or the full equipment rig compiler.
Run `python tools/check-caster-walk.py` to check all 256 delivered poses.
Review `/tools/caster-walk-review.html` for both classes/appearances, all directions,
frame stepping, pause, staff/scripture selection and optional orb equipment.
