# First west-bank open world

The pre-bridge field expands from 117 × 176 to 1170 × 1760 world units: exactly 100 times its area (10 times each dimension). The east bank and dungeon gates retain their previous positions. The village entrance moves to the western end, connected to the bridge by safe trails. No new houses are placed outside the village.

`unity_preview/open-world-first.js` owns bounds, connected trail polylines, deterministic 100-slime placement, habitat checks and the shared water-droplet model. West trails are 14 units wide. Swept slime movement checks exclude trails, including during pursuit; players on safe trails cannot be attacked. The minimap accounts for the asymmetric land area.

Each slime has 100 HP, awards 1 XP, and drops exactly one green crystal. Existing persisted 600-second enemy respawn and MP recovery remain unchanged. Other enemy variants await specifications.

Terrain UV density is retained rather than stretching/downsampling the original textures. Decorative scenery uses instancing. No APK has been built for this change.

Validation: `node Tools/test_west_field_slimes.mjs`, plus the ten existing timing, village, guild, landscape, camera, map and merchant regression suites pass. Inline JavaScript syntax and `git diff --check` pass. These are automated checks, not an on-device visual/performance playtest.
