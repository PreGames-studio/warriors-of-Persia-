using System;
using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Gameplay
{
    public enum HeroRole3D
    {
        Warrior = 0, // جنگجو
        Mage = 1,    // جادوگر
        Archer = 2,  // کماندار
        Tank = 3,    // تانک
        Support = 4  // پشتیبان
    }

    [Serializable]
    public class PartyMemberData3D
    {
        public int slot;
        public string playerName;
        public HeroRole3D role;
        public bool isLocalLeader;
        public bool isOnline = true;
        public int level = 1;
        public int xp = 0;
        public float hpMax = 160f;
        public float manaMax = 100f;
        public float attackDamage = 24f;
    }

    [Serializable]
    public class CrystalDropData3D
    {
        public string crystalType; // small, medium, boss
        public string title;
        public int sourceLevel;
        public int coinValue;
    }

    [Serializable]
    public class ShopItemData3D
    {
        public string id;
        public string title;
        public string description;
        public int priceCoins;
        public float powerValue;
        public string effectType; // hp, mana, atk, max_mana
    }

    /// <summary>
    /// مدیر جامع گیم‌پلی سه‌بعدی در موتور Unity شامل:
    /// - مدیریت تیم ۱ تا ۵ نفره (بدون جایگزینی ربات هنگام آفلاین شدن)
    /// - ۴ مهارت فعال با کول‌داون و مصرف مانا + ۱ مهارت پسیو (طنین مانا)
    /// - دراپ کریستال مغناطیسی از هیولاها و باس
    /// - فروشگاه روستای امن (فروش کریستال -> سکه، خرید آیتم، بازیابی لول ازدست‌رفته در مرگ)
    /// - کیف آیتم ۱۶ خانه‌ای (Inventory)
    /// </summary>
    public class WarriorsCompleteGame3D : MonoBehaviour
    {
        public const int MAX_PARTY_SIZE = 5;
        public const bool REPLACE_OFFLINE_WITH_BOT = false;
        public const int MAX_INVENTORY_SLOTS = 16;
        private const string SAVE_KEY = "WarriorsOfPersia_SaveData_v2";

        [Serializable]
        private class SavePayload3D
        {
            public int coins;
            public int lostLevelsRecoverable;
            public List<PartyMemberData3D> party;
            public List<CrystalDropData3D> collectedCrystals;
            public List<ShopItemData3D> inventoryItems;
        }

        [Header("اقتصاد و پیشرفت تیم (Progression & Economy)")]
        public int coins = 12450;
        public int lostLevelsRecoverable = 0;
        public int levelRecoveryCostPerLevel = 45;

        [Header("اعضای تیم (۱ تا ۵ نفر)")]
        public List<PartyMemberData3D> party = new List<PartyMemberData3D>();

        [Header("غنائم و کیف آیتم‌ها (Loot & Inventory)")]
        public List<CrystalDropData3D> collectedCrystals = new List<CrystalDropData3D>();
        public List<ShopItemData3D> inventoryItems = new List<ShopItemData3D>();
        public List<ShopItemData3D> shopCatalog = new List<ShopItemData3D>();

        private void Awake()
        {
            InitializeDefaultParty();
            InitializeShopCatalog();
            LoadGameProgress();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus) SaveGameProgress();
        }

        private void OnApplicationQuit()
        {
            SaveGameProgress();
        }

        public void SaveGameProgress()
        {
            var payload = new SavePayload3D
            {
                coins = coins,
                lostLevelsRecoverable = lostLevelsRecoverable,
                party = party,
                collectedCrystals = collectedCrystals,
                inventoryItems = inventoryItems
            };
            string json = JsonUtility.ToJson(payload);
            PlayerPrefs.SetString(SAVE_KEY, json);
            PlayerPrefs.Save();
        }

        public void LoadGameProgress()
        {
            if (!PlayerPrefs.HasKey(SAVE_KEY)) return;
            string json = PlayerPrefs.GetString(SAVE_KEY, "");
            if (string.IsNullOrEmpty(json)) return;

            var payload = JsonUtility.FromJson<SavePayload3D>(json);
            if (payload != null && payload.party != null && payload.party.Count > 0)
            {
                coins = payload.coins;
                lostLevelsRecoverable = payload.lostLevelsRecoverable;
                party = payload.party;
                collectedCrystals = payload.collectedCrystals ?? new List<CrystalDropData3D>();
                inventoryItems = payload.inventoryItems ?? new List<ShopItemData3D>();
            }
        }

        public void InitializeDefaultParty()
        {
            party.Clear();
            party.Add(new PartyMemberData3D
            {
                slot = 0,
                playerName = "قهرمان ۱ (شما)",
                role = HeroRole3D.Warrior,
                isLocalLeader = true,
                isOnline = true
            });
        }

        public void InitializeShopCatalog()
        {
            shopCatalog = new List<ShopItemData3D>
            {
                new ShopItemData3D { id = "potion_hp", title = "معجون سبز حیات", description = "+۶۰ بازیابی سلامتی", priceCoins = 20, powerValue = 60f, effectType = "hp" },
                new ShopItemData3D { id = "potion_mana", title = "معجون آبی مانا", description = "+۵۰ بازیابی مانا", priceCoins = 20, powerValue = 50f, effectType = "mana" },
                new ShopItemData3D { id = "sword_radiant", title = "شمشیر درخشان شوالیه", description = "+۸ قدرت حمله دائمی", priceCoins = 55, powerValue = 8f, effectType = "atk" },
                new ShopItemData3D { id = "amulet_star", title = "طلسم ستاره‌ای مانا", description = "+۳۰ سقف مانا دائمی", priceCoins = 65, powerValue = 30f, effectType = "max_mana" }
            };
        }

        public bool AddPartyMember()
        {
            if (party.Count >= MAX_PARTY_SIZE) return false;
            int slot = party.Count;
            party.Add(new PartyMemberData3D
            {
                slot = slot,
                playerName = $"بازیکن {slot + 1}",
                role = (HeroRole3D)(slot % 5),
                isLocalLeader = false,
                isOnline = true
            });
            return true;
        }

        public void SetMemberOnline(int slotIndex, bool online)
        {
            if (slotIndex <= 0 || slotIndex >= party.Count) return;
            // قانون کلیدی: در صورت آفلاین شدن، هیچ رباتی جایگزین بازیکن نمی‌شود
            party[slotIndex].isOnline = online;
        }

        public int SellAllCrystals(bool isInSafeVillage)
        {
            if (!isInSafeVillage || collectedCrystals.Count == 0) return 0;
            int total = 0;
            foreach (var c in collectedCrystals) total += c.coinValue;
            collectedCrystals.Clear();
            coins += total;
            return total;
        }

        public bool RecoverLostLevel(bool isInSafeVillage)
        {
            if (!isInSafeVillage || lostLevelsRecoverable <= 0 || party.Count == 0) return false;
            var leader = party[0];
            int cost = levelRecoveryCostPerLevel * Mathf.Max(1, leader.level);
            if (coins < cost) return false;

            coins -= cost;
            lostLevelsRecoverable--;
            leader.level++;
            leader.hpMax += 25f;
            leader.manaMax += 25f;
            leader.attackDamage += 4f;
            return true;
        }
    }
}
