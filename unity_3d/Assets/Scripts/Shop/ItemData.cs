using System;
using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Shop
{
    public enum BlacksmithItemCategory
    {
        All = 0,
        Weapon = 1,     // شمشیر، چکش، تبر، نیزه، کمان
        Shield = 2,     // سپر فلزی
        Helmet = 3,     // کلاه‌خود آهنی
        Gauntlets = 4,  // دستکش زرهی
        Boots = 5,      // چکمه زرهی
        ArmorAndSpecial = 6 // زره سینه و تجهیزات ویژه
    }

    public enum ItemRarityTier
    {
        Common = 0,     // معمولی (فولاد استاندارد)
        Rare = 1,       // کمیاب (آب‌دیده)
        Epic = 2,       // حماسی (کاویانی)
        Legendary = 3   // افسانه‌ای (پهلوانی)
    }

    /// <summary>
    /// داده‌های هر آیتم قابل فروش در فروشگاه آهنگری (ScriptableObject قابل ویرایش در Inspector یونیتی).
    /// </summary>
    [CreateAssetMenu(fileName = "NewBlacksmithItem", menuName = "Warriors of Persia/Shop/Blacksmith Item Data")]
    public class ItemData : ScriptableObject
    {
        [Header("شناسه و مشخصات پایه (Identity & Localization)")]
        public string itemId = "iron_sword";
        public string itemNameFa = "شمشیر آهنی";
        public string itemNameEn = "Iron Sword";

        [TextArea(2, 4)]
        public string shortDescriptionFa = "یک شمشیر محکم و قابل اعتماد برای نبردهای روزمره.";

        [TextArea(3, 6)]
        public string detailedLoreFa = "ساخته‌شده از فولاد آبدیده در کوره استاد کاوه؛ توازن عالی بین وزن و برندگی برای نبردهای نزدیک.";

        [Header("دسته‌بندی و کمیابی (Category & Rarity)")]
        public BlacksmithItemCategory category = BlacksmithItemCategory.Weapon;
        public ItemRarityTier rarity = ItemRarityTier.Common;

        [Header("اقتصاد و موجودی فروشنده (Economy & Stock)")]
        [Min(1)]
        public int priceGold = 1200;
        public bool preventDuplicatePurchase = true;
        public int vendorStock = 1; // -1 = نامحدود

        [Header("ویژگی‌های رزمی آیتم (Combat Stats)")]
        public float attackBonus = 18f;
        public float defenseBonus = 0f;
        public float maxHpBonus = 0f;
        public float moveSpeedBonusPercent = 0f;

        [Header("دارایی‌های بصری و سه‌بعدی (Visual Assets)")]
        [Tooltip("آیکون اختصاصی آیتم؛ در صورت خالی بودن، رندرر رویه‌ای سه‌بعدی جایگزین می‌شود.")]
        public Sprite iconSprite;
        [Tooltip("پریفب مدل سه‌بعدی آیتم برای پیش‌نمایش در پنل جزئیات")]
        public GameObject previewModelPrefab;
        public Color primaryMetalColor = new Color(0.72f, 0.75f, 0.80f);
        public Color accentTrimColor = new Color(0.88f, 0.68f, 0.24f);

        /// <summary>
        /// ساخت کاتالوگ پیش‌فرض شامل ۶ آیتم صفحه اول تصویر مرجع + آیتم‌های قبلی آهنگری و تجهیزات تکمیلی برای اسکرول عمودی.
        /// </summary>
        public static List<ItemData> CreateDefaultBlacksmithCatalog()
        {
            var list = new List<ItemData>
            {
                // --- ۶ آیتم صفحه نخست (مطابق تصویر مرجع و مشخصات) ---
                CreateRuntimeItem(
                    "iron_sword", "شمشیر آهنی", "Iron Sword",
                    "یک شمشیر محکم و قابل اعتماد برای نبردهای روزمره.",
                    "تیغه‌ای از فولاد چکش‌کاری‌شده با قبضه چرم‌پیچ و محافظ برنجی؛ مناسب تمام جنگجویان در آغاز نبرد.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Common, 1200,
                    atk: 18f, def: 2f, hp: 0f, spd: 0f
                ),
                CreateRuntimeItem(
                    "war_hammer", "چکش جنگی", "War Hammer",
                    "قدرت تخریب بالا، مناسب برای جنگ‌های سنگین.",
                    "پتک فولادی سنگین با سر حکاکی‌شده که سپر و زره سنگین دشمنان نخبه را در هم می‌شکند.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Rare, 1800,
                    atk: 26f, def: 0f, hp: 10f, spd: -2f
                ),
                CreateRuntimeItem(
                    "iron_shield", "سپر فلزی (تارک آهنی)", "Iron Crest Shield",
                    "محافظت عالی در برابر ضربات دشمن.",
                    "سپر فولادی تقویت‌شده با نشان شیر طلایی برجسته و لبه‌های پرچ‌کاری‌شده برای مهار سنگین‌ترین ضربات.",
                    BlacksmithItemCategory.Shield, ItemRarityTier.Rare, 1500,
                    atk: 0f, def: 18f, hp: 45f, spd: 0f
                ),
                CreateRuntimeItem(
                    "iron_helmet", "کلاه‌خود آهنی", "Iron Great Helm",
                    "افزایش دفاع و مقاومت در میدان نبرد.",
                    "کلاه‌خود رزمی تمام‌رخ از آهن آبدیده با درزهای تقویت‌شده که سر و گردن قهرمان را کاملاً محافظت می‌کند.",
                    BlacksmithItemCategory.Helmet, ItemRarityTier.Common, 1000,
                    atk: 0f, def: 12f, hp: 30f, spd: 0f
                ),
                CreateRuntimeItem(
                    "armored_gauntlets", "دستکش زرهی (دستکش آهنی)", "Armored Gauntlets",
                    "محافظت از دست‌ها و افزایش قدرت ضربه.",
                    "دستکش‌های مفصلی از ورقه‌های فولاد و آستر چرم ضخیم که مهارت قبضه‌گیری سلاح و قدرت ضربه را بالا می‌برد.",
                    BlacksmithItemCategory.Gauntlets, ItemRarityTier.Common, 900,
                    atk: 10f, def: 8f, hp: 15f, spd: 0f
                ),
                CreateRuntimeItem(
                    "armored_boots", "چکمه زرهی (گروه آهنی)", "Armored Greaves",
                    "افزایش سرعت حرکت و مقاومت در برابر ضربات.",
                    "چکمه‌های رزمی ساق‌بلند با صفحات ساق‌بند فولادی و کفه چرمی منعطف برای حرکت سریع در میدان نبرد.",
                    BlacksmithItemCategory.Boots, ItemRarityTier.Common, 1100,
                    atk: 0f, def: 10f, hp: 20f, spd: 15f
                ),

                // --- آیتم‌های قبلی آهنگری کاوه و تجهیزات بیشتر (قابل مشاهده با اسکرول عمودی واقعی) ---
                CreateRuntimeItem(
                    "sword_kiani", "شمشیر کاویانی (آهنگری کاوه)", "Kiani Immortal Blade",
                    "شمشیر اصیل گارد جاویدان؛ +۱۲ قدرت حمله دائمی.",
                    "شمشیر سنتی آهنگری کاوه با آلیاژ درخشان پارسی و حکاکی‌های زرین روی تیغه.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Epic, 60,
                    atk: 12f, def: 3f, hp: 0f, spd: 5f
                ),
                CreateRuntimeItem(
                    "armor_persian", "زره پولادین پارسی (آهنگری کاوه)", "Persian Steel Cuirass",
                    "زره پولادین نقش‌برجسته؛ +۴۰ سقف سلامتی دائمی.",
                    "جوشن پولادین ساخت راسته آهنگران روستا که مقاومت قهرمان را در برابر حملات باس‌ها دوچندان می‌کند.",
                    BlacksmithItemCategory.ArmorAndSpecial, ItemRarityTier.Epic, 55,
                    atk: 0f, def: 15f, hp: 40f, spd: 0f
                ),
                CreateRuntimeItem(
                    "bow_arash", "کمان آرش کمانگیر", "Bow of Arash",
                    "کمان افسانه‌ای با برد و دقت بالا؛ +۱۴ قدرت حمله.",
                    "کمان مرکب از چوب سرخدار، شاخ و زه ابریشمین تقویت‌شده با قبضه طلاکوب.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Epic, 65,
                    atk: 14f, def: 0f, hp: 0f, spd: 8f
                ),
                CreateRuntimeItem(
                    "chest_plate_royal", "زره سینه شوالیه تاریکی", "Dark Knight Chestplate",
                    "زره کامل سینه از فولاد آب‌دیده؛ +۸۰ سلامتی و دفاع عالی.",
                    "سنگین‌ترین و مقاوم‌ترین زره سینه موجود در آهنگری با ورقه‌های فولاد سیاه‌کاری‌شده و تذهیب طلایی.",
                    BlacksmithItemCategory.ArmorAndSpecial, ItemRarityTier.Legendary, 2200,
                    atk: 5f, def: 28f, hp: 80f, spd: 0f
                ),
                CreateRuntimeItem(
                    "battle_axe_double", "تبر جنگی دوطرفه", "Double-Bit Battle Axe",
                    "تبر سنگین فولادی برای شکافتن زره دشمنان؛ +۳۲ حمله.",
                    "تبر دوپر با دسته چوب بلوط و تیغه‌های هلالی تیز که در نبردهای نزدیک آسیب ویرانگری وارد می‌کند.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Rare, 1950,
                    atk: 32f, def: 0f, hp: 0f, spd: 0f
                ),
                CreateRuntimeItem(
                    "immortal_spear", "نیزه گارد جاویدان", "Immortal Guard Spear",
                    "نیزه بلند با سر فولادی حکاکی‌شده؛ +۲۲ حمله و برد بیشتر.",
                    "نیزه مخصوص هنگ جاویدان پارس با سر فولادی الماس‌تراش و گوی متوازن‌کننده برنجی در انتها.",
                    BlacksmithItemCategory.Weapon, ItemRarityTier.Rare, 1400,
                    atk: 22f, def: 5f, hp: 15f, spd: 5f
                )
            };

            return list;
        }

        private static ItemData CreateRuntimeItem(
            string id, string nameFa, string nameEn,
            string shortDesc, string lore,
            BlacksmithItemCategory cat, ItemRarityTier rarityTier, int price,
            float atk, float def, float hp, float spd)
        {
            ItemData data = CreateInstance<ItemData>();
            data.name = $"ItemData_{id}";
            data.itemId = id;
            data.itemNameFa = nameFa;
            data.itemNameEn = nameEn;
            data.shortDescriptionFa = shortDesc;
            data.detailedLoreFa = lore;
            data.category = cat;
            data.rarity = rarityTier;
            data.priceGold = price;
            data.preventDuplicatePurchase = true;
            data.vendorStock = 1;
            data.attackBonus = atk;
            data.defenseBonus = def;
            data.maxHpBonus = hp;
            data.moveSpeedBonusPercent = spd;
            return data;
        }
    }
}
