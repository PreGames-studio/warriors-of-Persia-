# Adventure guild

A three-storey central village landmark replaces the central fountain. It uses
existing village stone, adobe, timber, tile and bronze materials, with a double
door, lit windows on all three floors, a balcony, roof and guild banners.
The exterior is solid scenery with collision; a portal in front of the door
loads a dedicated `guild` zone rather than walking into the exterior mesh.

The guild zone now contains a furnished hall with 12 lateral tables, five chairs
per table, an unobstructed central aisle, and a rear counter with two staff NPCs.
The registrar provides free persistent membership; the buyer purchases inventory
items for 35% of their original price and crystals for their existing coin value. `unity_preview/adventure-guild.js` owns its dimensions
and build function, so a future user-specified interior can replace it separately.
The zone has flat elevation, independent movement bounds, safe-zone regeneration,
persistent location handling, and no combat-map generation or enemies.
Exit returns the party to the village forecourt, outside the entry trigger.
Old village saves inside the new building relocate to the clear forecourt.
The guild uses only a shield icon on the minimap, without a text label.

Validation: guild geometry/entry/exit tests, map and gate returns, village,
landscape, camera and merchant tests pass. No APK built. Visual/device playtest
not performed.
