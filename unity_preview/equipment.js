/**
 * Paper-doll equipment rules for Mia's inventory.
 *
 * The sword, the shield and the four armour pieces each own a dedicated cell.
 * They never take a backpack cell, so the 16 bag slots stay free for potions
 * and loot. Worn pieces contribute their stats; the same piece sitting in the
 * bag does not (it only contributes again once it is worn).
 */

export const BAG_CAPACITY = 16;

/** The six worn cells, in the order the UI shows them. */
export const EQUIP_SLOTS = [
  { key: 'weapon', label: 'سلاح اصلی', icon: '⚔️', column: 'weapon' },
  { key: 'shield', label: 'سپر', icon: '🛡️', column: 'weapon' },
  { key: 'helmet', label: 'کلاه‌خود', icon: '🪖', column: 'gear' },
  { key: 'chest', label: 'زره سینه', icon: '🥋', column: 'gear' },
  { key: 'gauntlets', label: 'دستکش', icon: '🧤', column: 'gear' },
  { key: 'boots', label: 'چکمه', icon: '🥾', column: 'gear' },
];

export const EQUIP_KEYS = EQUIP_SLOTS.map((slot) => slot.key);

/** Blacksmith/merchant category → worn cell. Anything else stays a bag item. */
export const CATEGORY_TO_SLOT = {
  weapon: 'weapon',
  shield: 'shield',
  helmet: 'helmet',
  special: 'chest',
  gauntlets: 'gauntlets',
  boots: 'boots',
};

/** Emoji stand-ins for bag items that have no artwork. */
export const BAG_ICONS = {
  hp: '🧪',
  mana: '💧',
  atk: '⚔️',
  max_hp: '❤️',
  max_mana: '🔮',
  full_restore: '✨',
};

export const emptyEquipment = () => ({
  weapon: null,
  shield: null,
  helmet: null,
  chest: null,
  gauntlets: null,
  boots: null,
});

export function slotForItem(item) {
  const slot = item && CATEGORY_TO_SLOT[item.category];
  return slot && EQUIP_KEYS.includes(slot) ? slot : null;
}

/** Only these two numbers are ever granted by a piece of gear. */
export function itemBonuses(item) {
  return {
    atk: item && item.type === 'atk' ? Number(item.power) || 0 : 0,
    hpMax: Number(item && item.hpBonus) || 0,
  };
}

export function equipmentPower(equipment) {
  if (!equipment) return 0;
  return EQUIP_KEYS.reduce((sum, key) => {
    const bonus = itemBonuses(equipment[key]);
    return sum + bonus.atk + bonus.hpMax;
  }, 0);
}

export function normalizeEquipment(raw) {
  const out = emptyEquipment();
  if (raw && typeof raw === 'object') {
    EQUIP_KEYS.forEach((key) => {
      const value = raw[key];
      if (value && typeof value === 'object') out[key] = { ...value };
    });
  }
  return out;
}

/**
 * @param {object} options
 * @param {object} options.state      game state (party[0] is the hero)
 * @param {Function} [options.onChange] called after any stat change
 * @param {Function} [options.onToast]  optional (message, colour) reporter
 */
export function createEquipment({ state, onChange = () => {}, onToast = null }) {
  const leaderOf = () => (state.party && state.party[0]) || null;
  const bag = () => (Array.isArray(state.inventory) ? state.inventory : (state.inventory = []));
  const worn = () => (state.equipment = normalizeEquipment(state.equipment));

  function applyItemBonuses(item, sign) {
    const leader = leaderOf();
    if (!leader || !item) return;
    const bonus = itemBonuses(item);
    if (bonus.atk) leader.atk = Math.max(1, leader.atk + sign * bonus.atk);
    if (bonus.hpMax) {
      leader.hpMax = Math.max(50, leader.hpMax + sign * bonus.hpMax);
      leader.hp = Math.min(leader.hp, leader.hpMax);
    }
    onChange();
  }

  /**
   * Wear `item`. A piece already in that cell goes back to the bag — but only
   * when there is a free cell for it, otherwise the swap is refused so nothing
   * is ever silently destroyed.
   */
  function equipItem(item, options = {}) {
    const slot = slotForItem(item);
    if (!slot) return { ok: false, reason: 'not-equipment' };
    const { applyBonus = true, quiet = false } = options;
    const equipment = worn();
    const current = equipment[slot] || null;
    if (current && item.id && current.id === item.id) {
      return { ok: true, slot, swapped: null, already: true };
    }
    if (current && bag().length >= BAG_CAPACITY) {
      return { ok: false, reason: 'bag-full', slot, current };
    }
    if (current) {
      applyItemBonuses(current, -1);
      bag().push(current);
    }
    equipment[slot] = { ...item };
    if (applyBonus) applyItemBonuses(item, 1);
    if (!quiet && onToast) {
      const label = (EQUIP_SLOTS.find((entry) => entry.key === slot) || {}).label || slot;
      onToast(`پوشیده شد: ${item.title} (${label})`, '#fde047');
    }
    return { ok: true, slot, swapped: current || null };
  }

  /** Take a worn piece off; it needs a free bag cell to land in. */
  function unequipSlot(slotKey, options = {}) {
    const { quiet = false } = options;
    const equipment = worn();
    const item = equipment[slotKey];
    if (!item) return { ok: false, reason: 'empty' };
    if (bag().length >= BAG_CAPACITY) return { ok: false, reason: 'bag-full' };
    applyItemBonuses(item, -1);
    equipment[slotKey] = null;
    bag().push(item);
    if (!quiet && onToast) onToast(`${item.title} به کیف برگشت.`, '#cbd5e1');
    return { ok: true, item };
  }

  /** Tap on a bag entry: gear goes back on, the displaced piece drops into the freed cell. */
  function equipFromBag(index) {
    const items = bag();
    const item = items[index];
    if (!item) return { ok: false, reason: 'empty' };
    const slot = slotForItem(item);
    if (!slot) return { ok: false, reason: 'not-equipment' };
    const equipment = worn();
    const current = equipment[slot] || null;
    items.splice(index, 1);
    if (current) items.push(current);
    equipment[slot] = item;
    applyItemBonuses(item, 1);
    return { ok: true, slot, swapped: current || null };
  }

  /**
   * v1.0.16 saved bought gear inside the bag, with its stats already applied.
   * Move the first piece of each kind into its cell without paying twice; extra
   * duplicates stay in the bag and lose their (now inert) contribution.
   */
  function migrateFromBag() {
    const equipment = worn();
    const keep = [];
    bag().forEach((item) => {
      const slot = slotForItem(item);
      if (slot && !equipment[slot]) {
        equipment[slot] = item;
      } else {
        if (slot) applyItemBonuses(item, -1);
        keep.push(item);
      }
    });
    state.inventory = keep;
    return equipment;
  }

  return {
    applyItemBonuses,
    equipItem,
    unequipSlot,
    equipFromBag,
    migrateFromBag,
    power: () => equipmentPower(state.equipment),
    worn,
    bagSize: () => bag().length,
  };
}
