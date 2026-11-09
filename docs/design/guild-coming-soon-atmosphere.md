# Ground floor only, lively guild and 200 residents

Upper guild floors are deliberately unavailable (`GUILD_UPPER_FLOORS_OPEN=false`).
Only the two first stair flights remain visible behind barriers; no upper decks
or second flights are built. Both stair areas are collision-blocked, marked
«بزودی», and an attempted approach shows a throttled coming-soon message.
Saved positions from upstairs relocate safely to the ground-floor entrance.
Natural door entry/exit is unchanged.

Village ambient population increases from 100 to 200, in addition to quest NPCs:
50 children, 50 elders, 50 women and 50 men. Existing collision-aware house entry,
exit and waiting routines remain, with shared appearance templates and limited
route recalculation per frame.

The guild gains 20 flower arrangements (six large floor pots, two counter pots,
12 table vases), woven carpets under the 12 table groups, warm emissive wall
sconces and textile banners. Six floor pots have collision bounds.
24 seated guests occupy two chairs per table, with bent legs, animated heads
and arms. Twelve table conversations display occasional nearby dialogue text;
this is visual conversation, not recorded/synthesised speech. The central aisle,
60-chair seating plan and two working service NPCs remain intact.

Tests cover locked stairs and old saves, exact residents/profile counts,
24 seated guests / 12 conversations / 20 flower arrangements, furniture,
services and prior regression suites. No APK build or visual/device test run.
