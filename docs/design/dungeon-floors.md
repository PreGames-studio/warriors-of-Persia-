# First dungeon: 100-floor progression foundation

First dungeon identity remains tier 1; floor number is a separate dimension (never confused with the tier-3 fire dungeon). Save payload persists `dungeonFloor` and `dungeonProgress`. Boss death permanently clears the current floor and unlocks its successor; floor 100 completes the dungeon and has no successor. Respawn keys include the first-dungeon floor so kills on one floor do not suppress another floor's enemies. Existing 10-minute respawn remains intact; a respawned boss does not revoke permissions.

Entry presents a modal selector listing only unlocked floors, defaulting to the highest permission. The northern next-floor portal also checks permission. Existing saves start at floor 1; loading a saved dungeon position restores its authorized floor. Returning to the world still uses the original dungeon entrance.

`unity_preview/dungeon-floors.js` provides per-floor corridor, enemy, boss, trap, spawn and next-exit definitions. All 100 floors intentionally use a provisional shared content template, NOT 100 individually designed levels. Future floor-by-floor design should replace these definitions. Landscape route ribbons consume the corridor definition; they are not yet an enclosed architectural maze. The provisional visible orange trap activates periodically and damages the leader on contact, with a per-hit cooldown. New enemy types, unique boss art and final trap mechanics remain to be specified.

Validation: floor progression/save/bounds test and all existing regression suites pass; inline JavaScript syntax and diff checks pass. No device/browser playtest and no APK build performed.
