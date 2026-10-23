#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using WarriorsOfPersia.World;
using WarriorsOfPersia.CameraSystem;
using WarriorsOfPersia.Units;

namespace WarriorsOfPersia.EditorTools
{
    /// <summary>
    /// منوی ابزار اختصاصی در نوار بالای Unity Editor برای ساخت خودکار صحنه و نقشه ۳ بعدی با یک کلیک
    /// </summary>
    public static class WarriorsMapEditorMenu
    {
        [MenuItem("Warriors of Persia/1. ساخت نقشه سه‌بعدی جهان باز (OpenWorld 3D)")]
        public static void BuildOpenWorldScene()
        {
            CreateCompleteScene(MapZoneType.OpenWorld);
        }

        [MenuItem("Warriors of Persia/2. ساخت نقشه سه‌بعدی روستای امن (Village 3D)")]
        public static void BuildVillageScene()
        {
            CreateCompleteScene(MapZoneType.Village);
        }

        [MenuItem("Warriors of Persia/3. ساخت نقشه سه‌بعدی سیاه‌چال و باس (Dungeon 3D)")]
        public static void BuildDungeonScene()
        {
            CreateCompleteScene(MapZoneType.Dungeon);
        }

        private static void CreateCompleteScene(MapZoneType zone)
        {
            PersianWorldMapBuilder builder = Object.FindObjectOfType<PersianWorldMapBuilder>();
            if (builder == null)
            {
                GameObject mapGO = new GameObject("WarriorsOfPersia_3DWorld");
                builder = mapGO.AddComponent<PersianWorldMapBuilder>();
            }

            builder.BuildMap(zone);

            // ساخت قهرمان ۳ بعدی در نقطه اسپاون
            HeroController3D hero = Object.FindObjectOfType<HeroController3D>();
            if (hero == null)
            {
                GameObject heroGO = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                heroGO.name = "Hero_PersianWarrior_3D";
                Object.DestroyImmediate(heroGO.GetComponent<CapsuleCollider>());
                CharacterController cc = heroGO.AddComponent<CharacterController>();
                cc.height = 2f;
                cc.radius = 0.6f;
                hero = heroGO.AddComponent<HeroController3D>();
            }

            if (builder.heroSpawnPoint != null)
            {
                hero.transform.position = builder.heroSpawnPoint.position + Vector3.up * 1.2f;
            }

            // تنظیم دوربین Top-Down سه‌بعدی
            Camera mainCam = Camera.main;
            if (mainCam != null)
            {
                TopDownCamera3D camCtrl = mainCam.GetComponent<TopDownCamera3D>();
                if (camCtrl == null) camCtrl = mainCam.gameObject.AddComponent<TopDownCamera3D>();
                camCtrl.target = hero.transform;
                mainCam.transform.position = hero.transform.position + camCtrl.offset;
                mainCam.transform.rotation = Quaternion.Euler(camCtrl.pitchAngle, 0f, 0f);
            }

            Selection.activeGameObject = builder.gameObject;
            SceneView.RepaintAll();
            Debug.Log($"[Warriors of Persia] نقشه سه‌بعدی {zone} با موفقیت در محیط Unity ساخته شد!");
        }
    }
}
#endif
