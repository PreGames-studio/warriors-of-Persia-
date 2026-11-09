# Village merchant expansion

All 20 village merchants now have a buying interface. Blacksmith and apothecary
retain their existing specialised interfaces. The other 18 professions use the
new responsive two-column merchant interface, with dark metal/gold frames,
a shared cinematic merchant portrait, profession accents, filtered item cards,
selection details, prices, inventory capacity and purchase feedback.

The catalog adds 108 profession-specific products (six per merchant). Item art
uses existing photographic equipment portraits where applicable, plus locally
authored gradient SVG material illustrations for remaining trades. These are
illustrations, not new photographic/PBR item assets. The portrait is shared;
this implementation does not provide 18 distinct shopkeeper portraits.

Purchasing checks the village zone, product ownership by catalog, gold, and
16-slot inventory capacity. Products use the existing inventory effect types;
bonuses take effect on inventory use, not at purchase. Purchases use the current
multi-layer persistent save. Jeweler crystal sale and astrologer level recovery
remain accessible in their new panels. Saddlery products provide inventory
bonuses; riding/mount mechanics are not implemented.

Tests: `node Tools/test_merchant_catalog.mjs`, plus existing layout/landscape
regression tests and JavaScript syntax checks. No browser/device visual test
was performed. No APK build or release was performed, per MD/قانون ۴.md.
The APK bundler was only updated to include the new CSS on a future explicit
build request.
