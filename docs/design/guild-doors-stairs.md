# Guild doors and upper floors

- Removed the village guild portal platform, columns, glowing ring and entry
  label. The circular decorative door badge was also removed.
- Removed the interior exit portal. A normal timber double door identifies the
  hall exit. Narrow invisible doorway triggers handle entry and exit on the
  ground floor only; dungeon/open-world portals remain unchanged.
- Added left and right U-shaped staircases beside the counter. Each has two
  flights (28 visible steps each), handrails and a rear turning landing,
  connecting elevations 0, 7 and 14 in the same guild scene, without teleporting
  between storeys. Added usable upper-floor decks with stairwell openings.
- Height-aware furniture/rail collisions keep ground-floor tables from blocking
  upper floors and prevent lateral shortcuts over stairwell openings. Overhead
  deck slabs are hidden while the player is below them to preserve the camera.
- Saved guild elevation is respected. Companions follow the leader's recent
  path through the staircases rather than trying to hold a wide lateral
  formation. Staff interactions stay on the ground floor.

Tests: both staircases ascend/descend continuously, saved upper-floor elevation,
no upper-floor doorway exit, invisible door transitions, furniture counts,
arrival safety, population/services and existing regressions. Tests pass;
no browser/device visual playtest and no APK build performed.
