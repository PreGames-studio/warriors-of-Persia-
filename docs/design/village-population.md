# Village residents and guild hall

Adds 100 ambient residents in addition to the existing 20 quest NPCs: 25 children,
25 elders, 25 women and 25 men. Scale, clothing/head covering, facial hair and
walking speed vary by profile; elders carry a cane. Appearance prototypes share
geometry/materials via cloned templates.

Residents use a common two-unit navigation grid built from current building
colliders. Eight-direction A* rejects diagonal corner cutting. Each accessible
house has a door point and a clear outdoor anchor. Residents emerge at doors,
walk the collision-aware route to another house, disappear at its door and wait
inside before leaving again. Ordinary house interiors are not newly rendered;
this is an ambient entry/exit simulation, not player-accessible home interiors.
Path recalculation is limited to two residents per frame. Resident names are
not added to the minimap or as a hundred floating world labels.

Guild hall: 12 tables (six on each side), 60 chairs, clear central aisle,
rear counter, two staff NPCs, clickable labels and proximity interactions.
Registration is free and saved in the existing persistent save payload.
The guild buyer buys an inventory item at 35% of its price, or all crystals
at their existing values. Selling an item does not undo stat bonuses that
were previously applied. No new quests, riding, or equipment system is added.

Tests cover exact furniture counts/aisle clearance, five-member safe arrival,
100-resident profile distribution, real village house navigation, 240 simulated
seconds of activity, membership persistence and guarded item resale.
No APK built; no visual browser or physical-device playtest performed.
