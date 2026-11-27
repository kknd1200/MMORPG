# Fixed character appearance

Player equipment affects gameplay stats and equip restrictions, not appearance.
The runtime draws the original idle/normal/skill sheets directly, including the
original weapon and shield. It never loads the equipment rig or draws item icons
on the character. Menus and gameplay share this renderer.

`fixed-walk.webp` preserves all 64 reviewed walking poses for each appearance.
One permanent class weapon is flattened into each sheet by
`node tools/rig/compile-fixed-walk.mjs` (requires @napi-rs/canvas and Python Pillow).
The knight shield is already painted into the source and is not overlaid again.
The warrior retains the reviewed trailing greatsword carry. Inventory items,
random options, enhancement and equipped slots are never inputs at runtime.
The source walking sheets and rig remain available for rebuilding only.
