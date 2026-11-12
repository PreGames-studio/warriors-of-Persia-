# MP and enemy timing

- Visible resource labels now use MP in the HUD, shop descriptions and potion UI.
  Internal `mana`/`max_mana` keys remain unchanged for existing saves and items.
- Automatic recovery grants exactly one MP per 600 wall-clock seconds, in every
  zone and at every level. Offline elapsed intervals count. Time spent at full
  MP cannot be banked for later. Potions, level-up rewards and other explicit
  restoration effects retain their existing behaviour.
- Per-member `mpRecoveryAt` is saved. Legacy saves receive a fresh timer. Saving
  and restoring zero MP no longer accidentally refills the resource.
- All normal, elite and boss enemies respawn 600 wall-clock seconds after death.
  Death deadlines are persisted by zone/tier/spawn position/rank/level, preventing
  immediate respawn through zone travel or restart. Expired entries are cleared.
- Tests exercise interval boundaries, offline/save round trips, full-resource
  caps, zero MP, clock rollback, all ranks and stable spawn identities.

No APK build or device playtest performed for this change.
