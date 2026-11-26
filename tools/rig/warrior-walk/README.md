# Warrior walking action

Eight directions (S, SW, W, NW, N, NE, E, SE) with eight distinct poses per direction
for both accepted warrior appearances. Male: short silver hair, red/gold armor.
Female: black high ponytail, dark/gold armor, pale shoulder armor and red waist cloth.

Artwork was edited with image generation using the existing character sheets and
the supplied foot-contact reference. Front-view cycles and rear diagonal cycles
were authored in separate sheets to keep both legs readable and show the back in
NW/NE views. Deterministic cleanup removes magenta, applies a shared scale per
source sheet, aligns feet and matches the existing palette. No procedural limbs
are drawn. Closed carry hands support the existing equipped-weapon renderer.

The two character `.webp` files contain reviewed 160px-cell sheets. `poses.json`
stores the explicit primary and secondary grip sockets and carry angles.
`*-before.webp` preserves the previous walking body for comparison; `qc.json`
records source quality checks and final dimensions/unique-pose counts.

Rebuild with `python tools/rig/compile_warrior_walk.py` or the full equipment rig
compiler. Run `python tools/check-warrior-legs.py` to verify delivered pixels,
both front legs, all 128 poses and both hand sockets. Review
`/tools/warrior-walk-review.html` while the game server is running.
