# Archer walking action

Eight directions (S, SW, W, NW, N, NE, E, SE), eight distinct frames per direction
for the short-haired male (`archer_male`) and long-haired female (`archer`) elf.
The existing green/gold clothing, blonde hair, leather pieces and back quiver are
the identity references. Walking uses alternating foot contacts, knee passing,
small torso movement and a free arm swing while the bow hand remains steady.

Artwork originates from image generation using the existing appearances and the
supplied foot-contact reference. The front cycles were generated separately.
Deterministic postprocessing removes magenta, aligns the feet, applies one shared
scale per source sheet and matches the existing palette. No procedural limbs are
drawn. The finished body sheets contain no baked bow; the equipped shortbow,
longbow or hornbow is drawn at the reviewed per-frame gripping-hand socket.
Rear walking poses reflect the bow outward around its grip while preserving its
upper-limb heading, so the curve is not completely buried behind the torso.

The character `.webp` files contain the 160px-cell bodies. `poses.json` stores
explicit grip sockets and draw order. `*-before.webp` preserves the previous
walking bodies for comparison; `qc.json` records the source and final checks.

Rebuild with `python tools/rig/compile_archer_walk.py`, or the full equipment rig
compiler. Check delivered pixels, both front legs and the hand sockets with
`python tools/check-archer-walk.py`. The review page is
`/tools/archer-walk-review.html`; it supports both appearances, eight directions,
frame stepping, pause and equipped-bow selection.
