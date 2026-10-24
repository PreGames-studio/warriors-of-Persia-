using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.World
{
    public enum MapZoneType
    {
        OpenWorld = 0,
        Village = 1,
        Dungeon = 2
    }

    /// <summary>
    /// سازنده رویه‌ای و خودکار نقشه سه‌بعدی بازی Warriors of Persia در موتور Unity.
    /// این اسکریپت تمام اجزای نقشه (زمین، رودخانه، پل چوبی، کوهستان زاگرس، ستون‌های تخت‌جمشیدی،
    /// روستای امن، چشمه شفا، فروشگاه کریستال، پورتال‌های دانجن و سیاه‌چال باس) را به‌صورت ۳ بعدی می‌سازد.
    /// </summary>
    [ExecuteAlways]
    public class PersianWorldMapBuilder : MonoBehaviour
    {
        [Header("تنظیمات نقشه فعال (Active Map Settings)")]
        public MapZoneType activeZone = MapZoneType.OpenWorld;
        public bool rebuildOnValidate = false;

        [Header("مراجع تولید شده (Generated Root)")]
        public Transform mapRoot;
        public Transform heroSpawnPoint;
        public List<Transform> enemySpawnPoints = new List<Transform>();

        private Dictionary<string, Material> _materials = new Dictionary<string, Material>();

        private void Start()
        {
            if (mapRoot == null || mapRoot.childCount == 0)
            {
                BuildMap(activeZone);
            }
        }

        private void OnValidate()
        {
            if (rebuildOnValidate)
            {
                rebuildOnValidate = false;
                BuildMap(activeZone);
            }
        }

        [ContextMenu("Build Active 3D Map")]
        public void BuildActiveMap()
        {
            BuildMap(activeZone);
        }

        public void BuildMap(MapZoneType zone)
        {
            activeZone = zone;
            ClearExistingMap();
            InitializeMaterials();

            GameObject rootObj = new GameObject($"MapRoot_{zone}_3D");
            rootObj.transform.SetParent(transform, false);
            mapRoot = rootObj.transform;
            enemySpawnPoints.Clear();

            switch (zone)
            {
                case MapZoneType.OpenWorld:
                    BuildOpenWorld3D(mapRoot);
                    break;
                case MapZoneType.Village:
                    BuildVillage3D(mapRoot);
                    break;
                case MapZoneType.Dungeon:
                    BuildDungeon3D(mapRoot);
                    break;
            }
        }

        public void ClearExistingMap()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                GameObject child = transform.GetChild(i).gameObject;
                if (Application.isPlaying)
                    Destroy(child);
                else
                    DestroyImmediate(child);
            }
        }

        private void InitializeMaterials()
        {
            _materials.Clear();
            Shader std = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");

            CreateMat("PlainsGrass", std, new Color(0.22f, 0.54f, 0.30f), 0.15f);
            CreateMat("HighlandGrass", std, new Color(0.28f, 0.49f, 0.27f), 0.15f);
            CreateMat("DirtRoad", std, new Color(0.68f, 0.56f, 0.39f), 0.1f);
            CreateMat("PersianStone", std, new Color(0.82f, 0.74f, 0.58f), 0.25f);
            CreateMat("TurquoiseTile", std, new Color(0.15f, 0.75f, 0.78f), 0.65f, new Color(0.05f, 0.3f, 0.35f));
            CreateMat("RiverWater", std, new Color(0.14f, 0.58f, 0.90f), 0.85f, new Color(0.04f, 0.18f, 0.32f));
            CreateMat("WoodBridge", std, new Color(0.55f, 0.36f, 0.20f), 0.2f);
            CreateMat("DarkWood", std, new Color(0.34f, 0.21f, 0.11f), 0.2f);
            CreateMat("MountainRock", std, new Color(0.38f, 0.37f, 0.44f), 0.1f);
            CreateMat("SnowCap", std, new Color(0.94f, 0.97f, 1.0f), 0.4f);
            CreateMat("CypressFoliage", std, new Color(0.14f, 0.42f, 0.24f), 0.1f);
            CreateMat("ForestPortalGlow", std, new Color(0.82f, 0.35f, 1.0f), 0.9f, new Color(0.65f, 0.20f, 0.90f));
            CreateMat("FirePortalGlow", std, new Color(1.0f, 0.38f, 0.18f), 0.9f, new Color(0.95f, 0.25f, 0.05f));
            CreateMat("VillagePortalGlow", std, new Color(0.25f, 0.95f, 0.62f), 0.9f, new Color(0.15f, 0.75f, 0.45f));
            CreateMat("VolcanicRock", std, new Color(0.22f, 0.16f, 0.18f), 0.15f);
            CreateMat("DungeonFloor", std, new Color(0.15f, 0.12f, 0.24f), 0.3f);
            CreateMat("DungeonCarpet", std, new Color(0.34f, 0.14f, 0.44f), 0.25f);
            CreateMat("GoldTrim", std, new Color(0.95f, 0.78f, 0.26f), 0.8f, new Color(0.25f, 0.18f, 0.02f));
            CreateMat("CobbleAlley", std, new Color(0.55f, 0.50f, 0.44f), 0.15f);
            CreateMat("AdobeWall", std, new Color(0.83f, 0.64f, 0.45f), 0.2f);
            CreateMat("AdobeBrick", std, new Color(0.74f, 0.54f, 0.37f), 0.2f);
        }

        private void CreateMat(string key, Shader shader, Color color, float smoothness, Color? emission = null)
        {
            Material mat = new Material(shader) { name = $"Mat_{key}" };
            mat.color = color;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", smoothness);
            if (emission.HasValue)
            {
                mat.EnableKeyword("_EMISSION");
                if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", emission.Value);
            }
            _materials[key] = mat;
        }

        // =====================================================================
        // 1. OPEN WORLD 3D (220 x 140 Units - Scaled to 220 x 140)
        // =====================================================================
        private void BuildOpenWorld3D(Transform root)
        {
            // زمین دشت غربی (West Plains)
            CreateBox("WestPlains_Ground", root, new Vector3(-52f, -0.5f, 0f), new Vector3(104f, 1f, 140f), "PlainsGrass");

            // زمین ارتفاعات شرقی (East Highlands)
            CreateBox("EastHighlands_Ground", root, new Vector3(58f, -0.2f, 0f), new Vector3(104f, 1.6f, 140f), "HighlandGrass");

            // رودخانه مرکزی (River)
            CreateBox("CentralRiver_Water", root, new Vector3(0f, -0.65f, 0f), new Vector3(14f, 0.5f, 140f), "RiverWater", false);

            // جاده خاکی از دروازه روستا تا پل و دانجن‌ها
            CreateBox("MainRoad_West", root, new Vector3(-48f, 0.04f, 0f), new Vector3(82f, 0.08f, 9f), "DirtRoad", false);
            CreateBox("MainRoad_East", root, new Vector3(32f, 0.64f, 0f), new Vector3(50f, 0.08f, 9f), "DirtRoad", false);

            // پل چوبی و سنگی روی رودخانه (Wooden Bridge)
            BuildWoodenBridge3D(root, new Vector3(0f, 0.4f, 0f));

            // رشته‌کوه شمالی زاگرس (Northern Mountains)
            Transform mountainGroup = new GameObject("NorthernMountains_Zagros").transform;
            mountainGroup.SetParent(root, false);
            BuildMountainPeak(mountainGroup, new Vector3(25f, 0f, 52f), 14f, 22f);
            BuildMountainPeak(mountainGroup, new Vector3(48f, 0f, 56f), 18f, 28f);
            BuildMountainPeak(mountainGroup, new Vector3(72f, 0f, 50f), 15f, 24f);
            BuildMountainPeak(mountainGroup, new Vector3(92f, 0f, 54f), 16f, 25f);
            BuildMountainPeak(mountainGroup, new Vector3(-28f, 0f, 56f), 13f, 19f);

            // پورتال غربی: ورود به روستای امن
            BuildPersianPortal3D(root, "Portal_To_Village", new Vector3(-88f, 0f, 0f), "VillagePortalGlow", "ورود به روستای امن (فروشگاه)");

            // پورتال شمال شرقی: دانجن ۱ (جنگل باستانی)
            BuildPersianPortal3D(root, "Portal_Dungeon_Forest_Lv1", new Vector3(54f, 0.6f, 28f), "ForestPortalGlow", "دانجن ۱: جنگل باستانی (Lv.1)");

            // پورتال جنوب شرقی: دانجن ۲ (کوهستان آتش)
            BuildPersianPortal3D(root, "Portal_Dungeon_Fire_Lv3", new Vector3(78f, 0.6f, -30f), "FirePortalGlow", "دانجن ۲: کوهستان آتش (Lv.3)");

            // صخره‌های آتشفشانی اطراف دانجن آتش
            BuildVolcanicCluster(root, new Vector3(78f, 0.6f, -30f));

            // درختان سرو پارسی در دشت و جنگل
            Vector3[] treePositions = {
                new Vector3(-70f, 0f, 28f), new Vector3(-62f, 0f, -26f), new Vector3(-35f, 0f, 34f),
                new Vector3(-25f, 0f, -32f), new Vector3(36f, 0.6f, 38f), new Vector3(68f, 0.6f, 36f),
                new Vector3(44f, 0.6f, 18f), new Vector3(64f, 0.6f, 16f)
            };
            Transform treesParent = new GameObject("PersianTrees_Group").transform;
            treesParent.SetParent(root, false);
            for (int i = 0; i < treePositions.Length; i++)
            {
                BuildCypressTree3D(treesParent, treePositions[i], $"CypressTree_{i + 1}");
            }

            // نقاط اسپاون قهرمان و دشمنان
            CreateSpawnMarker(root, "HeroSpawnPoint", new Vector3(-68f, 0.5f, 0f), true);
            CreateSpawnMarker(root, "MobSpawn_Plains_1", new Vector3(-36f, 0.5f, 2f), false);
            CreateSpawnMarker(root, "MobSpawn_Plains_2", new Vector3(-28f, 0.5f, 22f), false);
            CreateSpawnMarker(root, "MobSpawn_Plains_3", new Vector3(-30f, 0.5f, -22f), false);
            CreateSpawnMarker(root, "MobSpawn_Highland_4", new Vector3(30f, 1.1f, 4f), false);
            CreateSpawnMarker(root, "MobSpawn_Highland_5", new Vector3(58f, 1.1f, -8f), false);
        }

        // =====================================================================
        // 2. SAFE VILLAGE 3D (روستای امن پارسی با کوچه‌ها، خانه‌ها، بادگیرها و ۶ مغازه بازار)
        // =====================================================================
        private void BuildVillage3D(Transform root)
        {
            CreateBox("Village_Ground", root, new Vector3(0f, -0.5f, 0f), new Vector3(170f, 1f, 130f), "PlainsGrass");

            // شبکه سنگفرش کوچه‌ها و خیابان‌های روستا (Alleys Network)
            Transform alleys = new GameObject("CobblestoneAlleys_Network").transform;
            alleys.SetParent(root, false);
            CreateBox("MainStreet_EW", alleys, new Vector3(0f, 0.05f, 0f), new Vector3(135f, 0.1f, 13f), "CobbleAlley", false);
            CreateBox("MainStreet_NS", alleys, new Vector3(0f, 0.05f, 0f), new Vector3(14f, 0.1f, 96f), "CobbleAlley", false);
            CreateBox("NorthBazaar_Alley", alleys, new Vector3(0f, 0.06f, 14f), new Vector3(92f, 0.1f, 11f), "CobbleAlley", false);
            CreateBox("SouthCaravanserai_Alley", alleys, new Vector3(0f, 0.06f, -16f), new Vector3(84f, 0.1f, 11f), "CobbleAlley", false);
            CreateBox("WestBlacksmith_Alley", alleys, new Vector3(-28f, 0.06f, 0f), new Vector3(11f, 0.1f, 68f), "CobbleAlley", false);
            CreateBox("EastApothecary_Alley", alleys, new Vector3(28f, 0.06f, 0f), new Vector3(11f, 0.1f, 68f), "CobbleAlley", false);

            CreateCylinder("PersianStonePlaza", root, new Vector3(0f, 0.08f, 0f), new Vector3(26f, 0.1f, 26f), "PersianStone");

            // چشمه شفا و مانا در مرکز میدان روستا
            Transform fountain = new GameObject("HealingFountain_3D").transform;
            fountain.SetParent(root, false);
            fountain.localPosition = Vector3.zero;
            CreateCylinder("Fountain_Base", fountain, new Vector3(0f, 0.4f, 0f), new Vector3(9.6f, 0.4f, 9.6f), "PersianStone");
            CreateCylinder("Fountain_WaterPool", fountain, new Vector3(0f, 0.65f, 0f), new Vector3(8.2f, 0.2f, 8.2f), "TurquoiseTile", false);
            CreateSphere("Fountain_Orb", fountain, new Vector3(0f, 3.6f, 0f), 1.1f, "VillagePortalGlow");

            // ۶ مغازه و حجره سه‌بعدی در کوچه‌های روستا
            Transform shopsGroup = new GameObject("VillageBazaar_6_Shops").transform;
            shopsGroup.SetParent(root, false);
            BuildShopBuilding(shopsGroup, "Shop_1_Jeweler_Jamshid", new Vector3(-16f, 0f, 20f), "TurquoiseTile");
            BuildShopBuilding(shopsGroup, "Shop_2_Blacksmith_Kaveh", new Vector3(-38f, 0f, 18f), "FirePortalGlow");
            BuildShopBuilding(shopsGroup, "Shop_3_Apothecary_Hakim", new Vector3(16f, 0f, 20f), "VillagePortalGlow");
            BuildShopBuilding(shopsGroup, "Shop_4_Astrologer_Mage", new Vector3(38f, 0f, 18f), "ForestPortalGlow");
            BuildShopBuilding(shopsGroup, "Shop_5_Carpet_Bazaar", new Vector3(-28f, 0f, -22f), "FirePortalGlow");
            BuildShopBuilding(shopsGroup, "Shop_6_Teahouse_Caravanserai", new Vector3(26f, 0f, -22f), "GoldTrim");

            // خانه‌های کاهگلی و بادگیرهای سنتی در کوچه‌ها
            Transform housesGroup = new GameObject("VillageHouses_And_Alleys").transform;
            housesGroup.SetParent(root, false);
            BuildAdobeHouse(housesGroup, "House_NW_1", new Vector3(-46f, 0f, 34f), new Vector3(14f, 9f, 10f), true);
            BuildAdobeHouse(housesGroup, "House_NW_2", new Vector3(-26f, 0f, 34f), new Vector3(14f, 8.2f, 10f), false);
            BuildAdobeHouse(housesGroup, "House_NE_1", new Vector3(26f, 0f, 34f), new Vector3(14f, 8.8f, 10f), true);
            BuildAdobeHouse(housesGroup, "House_NE_2", new Vector3(46f, 0f, 34f), new Vector3(14f, 8f, 10f), false);
            BuildAdobeHouse(housesGroup, "House_SW_1", new Vector3(-44f, 0f, -36f), new Vector3(14f, 8.4f, 10f), false);
            BuildAdobeHouse(housesGroup, "House_SE_1", new Vector3(44f, 0f, -36f), new Vector3(14f, 8.8f, 10f), true);

            // پورتال خروج به جهان باز در انتهای خیابان شرقی
            BuildPersianPortal3D(root, "Portal_To_OpenWorld", new Vector3(62f, 0f, 0f), "TurquoiseTile", "دروازه خروج به جهان باز");
            CreateSpawnMarker(root, "HeroSpawnPoint", new Vector3(0f, 0.5f, -10f), true);
        }

        private void BuildShopBuilding(Transform parent, string name, Vector3 pos, string awningMatKey)
        {
            Transform shop = new GameObject(name).transform;
            shop.SetParent(parent, false);
            shop.localPosition = pos;
            CreateBox("StoreBuilding", shop, new Vector3(0f, 3.6f, 2.2f), new Vector3(11f, 7.2f, 7f), "AdobeWall");
            CreateBox("AwningCanopy", shop, new Vector3(0f, 5.6f, -2.2f), new Vector3(11.6f, 0.65f, 5.5f), awningMatKey);
            CreateBox("ShopCounter", shop, new Vector3(0f, 1.05f, -1.8f), new Vector3(8.2f, 2.1f, 2f), "WoodBridge");
        }

        private void BuildAdobeHouse(Transform parent, string name, Vector3 pos, Vector3 size, bool hasWindcatcher)
        {
            Transform house = new GameObject(name).transform;
            house.SetParent(parent, false);
            house.localPosition = pos;
            CreateBox("AdobeBody", house, new Vector3(0f, size.y * 0.5f, 0f), size, "AdobeWall");
            CreateBox("RoofParapet", house, new Vector3(0f, size.y + 0.35f, 0f), new Vector3(size.x + 0.4f, 0.7f, size.z + 0.4f), "AdobeBrick");
            if (hasWindcatcher)
            {
                CreateBox("Badgir_Windcatcher", house, new Vector3(0f, size.y + 2.4f, 0f), new Vector3(3.4f, 4.8f, 3.4f), "AdobeBrick");
            }
        }

        // =====================================================================
        // 3. ANCIENT DUNGEON 3D (سیاه‌چال باستانی + تالار باس)
        // =====================================================================
        private void BuildDungeon3D(Transform root)
        {
            CreateBox("Dungeon_Floor", root, new Vector3(0f, -0.5f, 0f), new Vector3(150f, 1f, 105f), "DungeonFloor");
            CreateBox("Dungeon_Carpet", root, new Vector3(0f, 0.05f, 0f), new Vector3(24f, 0.1f, 85f), "DungeonCarpet", false);
            CreateCylinder("BossArena_Platform", root, new Vector3(0f, 0.2f, 22f), new Vector3(46f, 0.25f, 46f), "DungeonCarpet");
            CreateCylinder("BossRune_Ring", root, new Vector3(0f, 0.48f, 22f), new Vector3(26f, 0.05f, 26f), "ForestPortalGlow", false);

            // ستون‌های سنگی سیاه‌چال
            for (int z = -30; z <= 30; z += 20)
            {
                BuildPersianColumn(root, new Vector3(-22f, 0f, z), $"DungeonPillar_L_{z}");
                BuildPersianColumn(root, new Vector3(22f, 0f, z), $"DungeonPillar_R_{z}");
            }

            BuildPersianPortal3D(root, "Portal_Exit_To_World", new Vector3(0f, 0f, -42f), "VillagePortalGlow", "خروج از دانجن به جهان باز");

            CreateSpawnMarker(root, "HeroSpawnPoint", new Vector3(0f, 0.5f, -30f), true);
            CreateSpawnMarker(root, "GuardSpawn_Left", new Vector3(-16f, 0.5f, -6f), false);
            CreateSpawnMarker(root, "GuardSpawn_Right", new Vector3(16f, 0.5f, -6f), false);
            CreateSpawnMarker(root, "GuardSpawn_Elite", new Vector3(0f, 0.5f, 4f), false);
            CreateSpawnMarker(root, "BossSpawnPoint", new Vector3(0f, 0.8f, 22f), false);
        }

        // =====================================================================
        // HELPER BUILDERS
        // =====================================================================
        private void BuildWoodenBridge3D(Transform parent, Vector3 center)
        {
            Transform bridge = new GameObject("WoodenBridge_3D").transform;
            bridge.SetParent(parent, false);
            bridge.localPosition = center;

            CreateBox("Bridge_Deck", bridge, new Vector3(0f, 0.2f, 0f), new Vector3(22f, 0.5f, 14f), "WoodBridge");
            CreateBox("Bridge_Railing_North", bridge, new Vector3(0f, 1.3f, 6.5f), new Vector3(22f, 1.6f, 0.8f), "DarkWood");
            CreateBox("Bridge_Railing_South", bridge, new Vector3(0f, 1.3f, -6.5f), new Vector3(22f, 1.6f, 0.8f), "DarkWood");
        }

        private void BuildMountainPeak(Transform parent, Vector3 pos, float radius, float height)
        {
            Transform peak = new GameObject("MountainPeak").transform;
            peak.SetParent(parent, false);
            peak.localPosition = pos;

            CreateCylinder("RockBase", peak, new Vector3(0f, height * 0.35f, 0f), new Vector3(radius * 2f, height * 0.35f, radius * 2f), "MountainRock");
            CreateCylinder("SnowPeak", peak, new Vector3(0f, height * 0.82f, 0f), new Vector3(radius * 1.1f, height * 0.18f, radius * 1.1f), "SnowCap");
        }

        private void BuildPersianPortal3D(Transform parent, string name, Vector3 pos, string glowMat, string label)
        {
            Transform portal = new GameObject(name).transform;
            portal.SetParent(parent, false);
            portal.localPosition = pos;

            CreateCylinder("Portal_Pedestal", portal, new Vector3(0f, 0.25f, 0f), new Vector3(11f, 0.25f, 11f), "PersianStone");
            BuildPersianColumn(portal, new Vector3(-4.2f, 0.2f, 0f), "Column_Left");
            BuildPersianColumn(portal, new Vector3(4.2f, 0.2f, 0f), "Column_Right");
            CreateBox("Portal_ArchTop", portal, new Vector3(0f, 8.6f, 0f), new Vector3(11f, 1.2f, 2.2f), "PersianStone");
            CreateCylinder("Portal_GlowCore", portal, new Vector3(0f, 4.2f, 0f), new Vector3(5.5f, 0.15f, 5.5f), glowMat, false);
        }

        private void BuildPersianColumn(Transform parent, Vector3 pos, string name)
        {
            Transform col = new GameObject(name).transform;
            col.SetParent(parent, false);
            col.localPosition = pos;

            CreateBox("Base", col, new Vector3(0f, 0.4f, 0f), new Vector3(2.2f, 0.8f, 2.2f), "PersianStone");
            CreateCylinder("Shaft", col, new Vector3(0f, 4.2f, 0f), new Vector3(1.3f, 3.8f, 1.3f), "PersianStone");
            CreateBox("Capital", col, new Vector3(0f, 8.0f, 0f), new Vector3(2.4f, 0.9f, 2.4f), "GoldTrim");
        }

        private void BuildCypressTree3D(Transform parent, Vector3 pos, string name)
        {
            Transform tree = new GameObject(name).transform;
            tree.SetParent(parent, false);
            tree.localPosition = pos;

            CreateCylinder("Trunk", tree, new Vector3(0f, 1.2f, 0f), new Vector3(0.9f, 1.2f, 0.9f), "DarkWood");
            CreateCylinder("Foliage_Lower", tree, new Vector3(0f, 4.2f, 0f), new Vector3(3.4f, 2.6f, 3.4f), "CypressFoliage");
            CreateCylinder("Foliage_Upper", tree, new Vector3(0f, 7.6f, 0f), new Vector3(2.1f, 2.0f, 2.1f), "CypressFoliage");
        }

        private void BuildVolcanicCluster(Transform parent, Vector3 center)
        {
            Transform cluster = new GameObject("VolcanicRocks_Cluster").transform;
            cluster.SetParent(parent, false);
            cluster.localPosition = center;

            CreateCylinder("LavaRock_1", cluster, new Vector3(-9f, 1.8f, -6f), new Vector3(4.5f, 1.8f, 4.5f), "VolcanicRock");
            CreateCylinder("LavaRock_2", cluster, new Vector3(9f, 2.2f, 5f), new Vector3(5.2f, 2.2f, 5.2f), "VolcanicRock");
            CreateCylinder("LavaRock_3", cluster, new Vector3(7f, 1.5f, -8f), new Vector3(3.8f, 1.5f, 3.8f), "VolcanicRock");
        }

        private void CreateSpawnMarker(Transform parent, string name, Vector3 pos, bool isHero)
        {
            GameObject marker = new GameObject(name);
            marker.transform.SetParent(parent, false);
            marker.transform.localPosition = pos;
            if (isHero)
                heroSpawnPoint = marker.transform;
            else
                enemySpawnPoints.Add(marker.transform);
        }

        private GameObject CreateBox(string name, Transform parent, Vector3 pos, Vector3 size, string matKey, bool withCollider = true)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            if (_materials.TryGetValue(matKey, out Material m))
                go.GetComponent<Renderer>().sharedMaterial = m;
            if (!withCollider && go.TryGetComponent<Collider>(out Collider c))
            {
                if (Application.isPlaying) Destroy(c); else DestroyImmediate(c);
            }
            return go;
        }

        private GameObject CreateCylinder(string name, Transform parent, Vector3 pos, Vector3 scale, string matKey, bool withCollider = true)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            if (_materials.TryGetValue(matKey, out Material m))
                go.GetComponent<Renderer>().sharedMaterial = m;
            if (!withCollider && go.TryGetComponent<Collider>(out Collider c))
            {
                if (Application.isPlaying) Destroy(c); else DestroyImmediate(c);
            }
            return go;
        }

        private GameObject CreateSphere(string name, Transform parent, Vector3 pos, float radius, string matKey)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = Vector3.one * (radius * 2f);
            if (_materials.TryGetValue(matKey, out Material m))
                go.GetComponent<Renderer>().sharedMaterial = m;
            return go;
        }
    }
}
