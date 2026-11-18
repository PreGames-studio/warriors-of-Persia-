/**
 * Node checks for the paper-doll equipment rules (`unity_preview/equipment.js`).
 *
 *   node Tools/tests/equipment.test.mjs
 *
 * No DOM and no three.js: the module only moves items and numbers around, so the
 * whole rule set (own cells for sword/shield, full-bag refusals, legacy saves)
 * can be verified before shipping an APK.
 */
import {
  BAG_CAPACITY, EQUIP_KEYS, slotForItem,
  emptyEquipment, normalizeEquipment, equipmentPower, createEquipment,
} from '../../unity_preview/equipment.js';

let failures = 0;
const check = (condition, message) => {
  if (condition) {
    console.log(`ok   ${message}`);
  } else {
    failures += 1;
    console.log(`FAIL ${message}`);
  }
};

const freshState = () => ({
  party: [{ atk: 24, hp: 160, hpMax: 160, mana: 100, manaMax: 100 }],
  inventory: [{ id: 'potion', title: 'potion', type: 'hp', power: 20 }],
  equipment: emptyEquipment(),
});

const sword = { id: 'iron_sword', title: 'شمشیر آهنی', category: 'weapon', type: 'atk', power: 18, hpBonus: 0 };
const sword2 = { id: 'sword_radiant', title: 'شمشیر کاویانی', category: 'weapon', type: 'atk', power: 12, hpBonus: 0 };
const shield = { id: 'iron_shield', title: 'سپر فلزی', category: 'shield', type: 'max_hp', power: 45, hpBonus: 45 };
const helmet = { id: 'iron_helmet', title: 'کلاه‌خود', category: 'helmet', type: 'max_hp', power: 30, hpBonus: 30 };
const gauntlets = { id: 'armored_gauntlets', title: 'دستکش', category: 'gauntlets', type: 'atk', power: 10, hpBonus: 15 };
const armor = { id: 'armor_persian', title: 'زره پارسی', category: 'special', type: 'max_hp', power: 40, hpBonus: 40 };
const boots = { id: 'armored_boots', title: 'چکمه', category: 'boots', type: 'max_hp', power: 20, hpBonus: 20 };

// --- every kind of gear has a cell, consumables stay in the bag ------------
check(slotForItem(sword) === 'weapon', 'weapon maps to the weapon cell');
check(slotForItem(shield) === 'shield', 'shield maps to the shield cell');
check(slotForItem(armor) === 'chest', 'chest armour maps to the chest cell');
check(slotForItem({ category: 'مصرفی' }) === null, 'merchant consumables stay in the bag');
check(slotForItem({ type: 'hp' }) === null, 'potions stay in the bag');

// --- wearing gear costs zero bag cells ------------------------------------
{
  const state = freshState();
  const api = createEquipment({ state });
  const bagBefore = state.inventory.length;
  check(api.equipItem(sword).ok, 'sword can be worn');
  check(api.equipItem(shield).ok, 'shield can be worn');
  check([helmet, gauntlets, armor, boots].every((item) => api.equipItem(item).ok), 'all six cells fill');
  check(state.inventory.length === bagBefore, 'bag count unchanged after wearing six pieces');
  check(EQUIP_KEYS.filter((key) => state.equipment[key]).length === 6, 'six cells report occupied');
  check(state.party[0].atk === 24 + 18 + 10, `attack gained sword+gauntlets (${state.party[0].atk})`);
  check(state.party[0].hpMax === 160 + 45 + 30 + 15 + 40 + 20, `hp max gained every bonus (${state.party[0].hpMax})`);
  check(equipmentPower(state.equipment) === (18 + 10) + (45 + 30 + 15 + 40 + 20), 'equipment power sums worn gear');
}

// --- swapping keeps the old piece and refunds its stats first --------------
{
  const state = freshState();
  const api = createEquipment({ state });
  api.equipItem(sword);
  const swap = api.equipItem(sword2);
  check(swap.ok && swap.swapped && swap.swapped.id === 'iron_sword', 'swap reports the displaced sword');
  check(state.equipment.weapon.id === 'sword_radiant', 'the new sword is worn');
  check(state.inventory.some((item) => item.id === 'iron_sword'), 'the old sword lands in the bag');
  check(state.party[0].atk === 24 + 12, `attack uses only the worn sword (${state.party[0].atk})`);
  check(api.equipItem(sword).ok, 'the bag sword can be worn again');
  check(state.party[0].atk === 24 + 18, `re-worn sword restores its attack (${state.party[0].atk})`);
}

// --- a full bag blocks swaps and unequips instead of losing gear ----------
{
  const state = freshState();
  const api = createEquipment({ state });
  api.equipItem(sword);
  while (state.inventory.length < BAG_CAPACITY) state.inventory.push({ id: `x${state.inventory.length}`, type: 'hp' });
  const swap = api.equipItem(sword2);
  check(swap.ok === false && swap.reason === 'bag-full', 'swap with a full bag is refused');
  check(state.equipment.weapon.id === 'iron_sword', 'refused swap leaves the worn sword in place');
  check(state.party[0].atk === 24 + 18, 'refused swap does not change stats');
  check(api.equipItem(shield).ok, 'an empty cell can still be filled while the bag is full');
  check(state.inventory.length === BAG_CAPACITY, 'the bag stays full');
  const off = api.unequipSlot('shield');
  check(off.ok === false && off.reason === 'bag-full', 'unequip with a full bag is refused');
  check(state.equipment.shield && state.equipment.shield.id === 'iron_shield', 'refused unequip keeps the shield worn');
}

// --- unequip returns the piece and removes its stats ----------------------
{
  const state = freshState();
  const api = createEquipment({ state });
  api.equipItem(helmet);
  const bagBefore = state.inventory.length;
  check(api.unequipSlot('helmet').ok, 'helmet unequips');
  check(state.equipment.helmet === null, 'the helmet cell is empty');
  check(state.inventory.length === bagBefore + 1, 'the helmet returns to the bag');
  check(state.party[0].hpMax === 160, 'the hp max bonus is removed');
  check(state.party[0].hp <= state.party[0].hpMax, 'current hp never exceeds the cap');
}

// --- equipping straight from a bag cell ----------------------------------
{
  const state = freshState();
  state.inventory.push(sword);
  const api = createEquipment({ state });
  const index = state.inventory.findIndex((item) => item.id === 'iron_sword');
  const result = api.equipFromBag(index);
  check(result.ok && result.slot === 'weapon', 'bag gear equips from its bag cell');
  check(state.equipment.weapon.id === 'iron_sword', 'the bag sword is now worn');
  check(!state.inventory.some((item) => item.id === 'iron_sword'), 'the bag copy is gone (no duplication)');
  check(state.party[0].atk === 24 + 18, 'equipping from the bag applies the bonus once');
}

// --- a 1.0.16 save (gear in the bag, stats already applied) --------------
{
  const state = freshState();
  state.party[0].atk = 24 + 18 + 10;
  state.party[0].hpMax = 160 + 45 + 30;
  state.inventory = [{ id: 'potion', type: 'hp' }, shield, sword, helmet, gauntlets];
  const api = createEquipment({ state });
  api.migrateFromBag();
  check(state.equipment.weapon.id === 'iron_sword', 'migration wears the sword');
  check(state.equipment.shield.id === 'iron_shield', 'migration wears the shield');
  check(state.equipment.helmet && state.equipment.gauntlets, 'migration wears the armour');
  check(state.inventory.length === 1, `only the potion stays in the bag (${state.inventory.length})`);
  check(state.party[0].atk === 24 + 18 + 10, `migration does not double the attack (${state.party[0].atk})`);
  check(state.party[0].hpMax === 160 + 45 + 30, `migration does not double the hp max (${state.party[0].hpMax})`);
}

// --- duplicate legacy gear stays in the bag but stops contributing -------
{
  const state = freshState();
  state.party[0].atk = 24 + 18 + 12;
  state.inventory = [sword, sword2];
  const api = createEquipment({ state });
  api.migrateFromBag();
  check(state.equipment.weapon.id === 'iron_sword', 'the first sword is worn');
  check(state.inventory.length === 1 && state.inventory[0].id === 'sword_radiant', 'the duplicate stays in the bag');
  check(state.party[0].atk === 24 + 18, `the bag duplicate no longer adds attack (${state.party[0].atk})`);
}

// --- persistence helpers -------------------------------------------------
{
  const normalized = normalizeEquipment({ weapon: sword, bogus: 1, shield: 'nope' });
  check(normalized.weapon.id === 'iron_sword', 'normalizeEquipment keeps valid cells');
  check(normalized.shield === null && normalized.helmet === null, 'normalizeEquipment drops junk');
  check(EQUIP_KEYS.length === 6, 'six equipment cells exist');
  check(BAG_CAPACITY === 16, 'the bag still has 16 cells');
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
process.exit(failures ? 1 : 0);
