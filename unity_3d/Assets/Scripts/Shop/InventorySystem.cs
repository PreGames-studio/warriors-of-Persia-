using System;
using System.Collections.Generic;
using UnityEngine;
using WarriorsOfPersia.Gameplay;
using WarriorsOfPersia.Units;

namespace WarriorsOfPersia.Shop
{
    /// <summary>
    /// مدیریت کیف آیتم‌های بازیکن (Inventory) شامل بررسی ظرفیت، جلوگیری از خرید تکراری ناخواسته و اعمال آمار رزمی تجهیزات.
    /// </summary>
    public class InventorySystem : MonoBehaviour
    {
        public static InventorySystem Instance { get; private set; }

        [Header("ظرفیت کیف آیتم‌ها")]
        public int maxInventorySlots = 16;

        [Header("لیست آیتم‌های خریداری‌شده و موجود در کیف")]
        [SerializeField] private List<ItemData> ownedItems = new List<ItemData>();

        private readonly HashSet<string> purchasedUniqueItemIds = new HashSet<string>();

        public event Action<IReadOnlyList<ItemData>> OnInventoryChanged;
        public event Action<ItemData> OnItemAdded;

        public IReadOnlyList<ItemData> OwnedItems => ownedItems;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
        }

        public bool IsItemAlreadyOwned(ItemData item)
        {
            if (item == null) return false;
            return purchasedUniqueItemIds.Contains(item.itemId);
        }

        public bool IsFull()
        {
            return ownedItems.Count >= maxInventorySlots;
        }

        public bool TryAddItem(ItemData item, out string errorMessageFa)
        {
            errorMessageFa = string.Empty;

            if (item == null)
            {
                errorMessageFa = "آیتم نامعتبر است.";
                return false;
            }

            if (item.preventDuplicatePurchase && IsItemAlreadyOwned(item))
            {
                errorMessageFa = $"«{item.itemNameFa}» قبلاً خریداری شده و در کیف شما موجود است!";
                return false;
            }

            if (IsFull())
            {
                errorMessageFa = "ظرفیت کیف شما (۱۶ خانه) تکمیل است!";
                return false;
            }

            ownedItems.Add(item);
            if (item.preventDuplicatePurchase)
            {
                purchasedUniqueItemIds.Add(item.itemId);
            }

            ApplyEquipmentStatsToHero(item);
            SyncWithMainGameInventory(item);

            OnItemAdded?.Invoke(item);
            OnInventoryChanged?.Invoke(ownedItems);
            return true;
        }

        private void ApplyEquipmentStatsToHero(ItemData item)
        {
            HeroController3D hero = FindObjectOfType<HeroController3D>();
            if (hero != null)
            {
                hero.attackDamage += item.attackBonus;
                hero.maxHp += item.maxHpBonus;
                hero.currentHp = Mathf.Min(hero.maxHp, hero.currentHp + item.maxHpBonus);
                if (item.moveSpeedBonusPercent != 0f)
                {
                    hero.moveSpeed *= (1f + item.moveSpeedBonusPercent * 0.01f);
                }
            }

            WarriorsCompleteGame3D game = FindObjectOfType<WarriorsCompleteGame3D>();
            if (game != null && game.party != null && game.party.Count > 0)
            {
                var leader = game.party[0];
                leader.attackDamage += item.attackBonus;
                leader.hpMax += item.maxHpBonus;
            }
        }

        private void SyncWithMainGameInventory(ItemData item)
        {
            WarriorsCompleteGame3D game = FindObjectOfType<WarriorsCompleteGame3D>();
            if (game != null && game.inventoryItems.Count < WarriorsCompleteGame3D.MAX_INVENTORY_SLOTS)
            {
                game.inventoryItems.Add(new ShopItemData3D
                {
                    id = item.itemId,
                    title = item.itemNameFa,
                    description = item.shortDescriptionFa,
                    priceCoins = item.priceGold,
                    powerValue = item.attackBonus > 0 ? item.attackBonus : item.maxHpBonus,
                    effectType = item.attackBonus > 0 ? "atk" : "hp"
                });
            }
        }
    }
}
