# Mia — asset provenance and licences

Everything in this folder is CC0 content plus our own authored additions. No
Mobile Legends (or any other commercial) character, texture or animation file
is copied into this project; only the general "polished mobile-MOBA hero" art
direction is used as inspiration.

## Source packs

| Content | Source | Licence |
| --- | --- | --- |
| Female base body, Ranger outfit, long hair, eyes | Quaternius *Universal Base Characters* / *Modular Character Outfits: Fantasy* (mirrored at `galessandrodale93-pixel/tras-sus-pasos-modelos`) | CC0 1.0 |
| Idle / walk / jog / jump clips | Quaternius *Universal Animation Library* (`hero-anims.glb`, `hero-anims2.glb`) | CC0 1.0 |
| Sword combo, block, dash, upper-cut, hit and throw clips | Quaternius *Universal Animation Library 2*, non-root-motion build (mirrored at `tilakpatell/tilakverse-assets`) | CC0 1.0 |

The GLB keeps every outfit variant in its own scene, each with a full copy of
the same 65-bone Humanoid skeleton. `unity_preview/mia-hero.js` keeps the
armatures for Mia's visible meshes, hides the other variants and duplicates each
animation clip per armature with the loader's duplicate-name suffix, so all
skeletons stay in sync. Nothing is decimated: 33,054 triangles and 13
SkinnedMeshes.

## What we changed

- **Cloth reskin only** (`Tools/prepare_mia_hq_assets.py`): green Ranger cloth
  pixels are remapped to crimson and the sleeves/trousers to blue-charcoal in
  the 512×512 albedo, re-encoded as *lossless* WebP at the original resolution.
  Leather, metal, stitching, normal maps, ORM maps, geometry and every other
  texture are untouched. 122,438 cloth pixels changed.
- **Authored props** (`unity_preview/mia-hero.js`): curved shamshir with a real
  blade profile, leather grip, wire wrap and pommel; socketted to the posed fist
  and with finger curls applied after the mixer; crimson neck scarf; two tapered
  belt tails; a small reflection probe so steel and gold read as metal.
- **Pose corrections**: a wrist offset that drops the resting blade to her side
  and a slight shoulder roll. Both fade to zero during one-shot combat clips, so
  authored slash poses are untouched.
- **Hand-painted material polish** (`Tools/polish_mia_materials.py`): the Ranger
  leather albedo and the skin albedo get masked local contrast, saturation and
  value, bounded to ±14 % per pixel; nothing is resized or re-encoded lossily
  (lossless WebP at 512² and 2048²). Normal and ORM maps are copied
  byte-for-byte. Recorded in `mia-polish-manifest.json`; the polished GLB
  (SHA-256 `c02ed09d…82b8`, 3,097,996 B) is what `mia-assets.js` embeds.
- **Runtime surface detail** (`unity_preview/mia-texture-detail.js`): procedural
  pore, weave and hair-strand relief is derived on canvas at load time and never
  written back to the source textures, so the HQ maps stay pristine.
- **Steel re-grade** for `Female_Ranger_Acc_Pauldrons`: the atlas paints a red
  sash across that UV island; the albedo is re-rendered to a narrow gunmetal
  luminance band so the plate reads as forged steel from every angle.

## Rebuilding

```bash
python3 Tools/prepare_mia_hq_assets.py \
  --model <base.glb> --locomotion <anims.glb> --actions <anims2.glb> \
  --combat <ual2.glb> --output-dir unity_preview/assets/hero/mia
```

Hashes and byte counts of every produced file are recorded in
`asset-manifest.json`. No texture is resized or re-encoded lossily at any step.
