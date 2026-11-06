# Attila sample character assets

- Base rig and animations: **Knight.glb**, KayKit Adventurers Character Pack 1.0.
- Author: **Kay Lousberg** — https://www.kaylousberg.com
- Upstream source: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- Upstream file: `addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`
- Licence: **Creative Commons Zero (CC0)**; the upstream licence is preserved in `LICENSE-KayKit.txt`.
- Original GLB SHA-256: `60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168`.
- `attila_base.glb` is byte-for-byte the upstream Knight GLB, including its 76 animation clips and original 1024×1024 embedded atlas.
- `attila_atlas.png` is an original-resolution (1024×1024), lossless recolour of that atlas for Attila's turquoise, midnight-blue, gold and crimson palette. No Mobile Legends assets are used.
- Attila's sun crest, sword rune, material tuning and gameplay animation state connections are original project code in `village-theme.js`.

The unmodified base is included for provenance and future Unity import. The runtime preview applies Attila's custom atlas and accessories after loading it.
- `attila-assets.js` embeds those exact GLB/atlas bytes as base64 so the Android `file://` WebView does not depend on prohibited `fetch(file://…)` requests.
