/** Dedicated full-resolution art for each shop's first purchasable product.
 * Prices, effects, IDs and the remainder of each catalog remain unchanged.
 * All 15 previously illustrated-only shops now have a dedicated signature image.
 */
export const SIGNATURE_ITEM_ART = Object.freeze(Object.fromEntries([
  'jeweler','astrologer','carpet_bazaar','teahouse',
  'district_shop_03','district_shop_04','district_shop_06',
  'district_shop_07','district_shop_08','district_shop_09',
  'district_shop_10','district_shop_11','district_shop_12','district_shop_13','district_shop_14'
].map(id=>[`${id}_item_1`,`./assets/merchants/signature/${id}.png`])));
