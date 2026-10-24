using UnityEngine;

namespace WarriorsOfPersia.Shop
{
    /// <summary>
    /// سازنده و کنترلر سه‌بعدی شخصیت آهنگر (کاوه) و کارگاه آهنگری قرون‌وسطایی:
    /// - در صورت وجود مدل FBX اختصاصی (customBlacksmithPrefab)، آن را بارگذاری و به Animator متصل می‌کند.
    /// - در صورت عدم وجود فایل FBX خارجی، یک مدل سه‌بعدی چندبخشی با متریال‌های PBR (چرم، فولاد، پیش‌بند آهنگری، کمربند ابزار، دستکش، سربند، ریش و سندان و کوره آتشین) می‌سازد.
    /// - شامل انیمیشن‌های تنفس، حرکت طبیعی بدن، پلک‌زدن دوره‌ای، چرخش تعاملی با ماوس/لمس و واکنش به انتخاب/خرید آیتم.
    /// </summary>
    public class BlacksmithCharacter3D : MonoBehaviour
    {
        [Header("مدل سه‌بعدی سفارشی (در صورت وجود فایل FBX/Prefab)")]
        [Tooltip("اگر مدل کاراکتر FBX آماده دارید اینجا قرار دهید؛ در غیر این صورت مدل سه‌بعدی رویه‌ای با جزئیات کامل ساخته می‌شود.")]
        public GameObject customBlacksmithPrefab;

        [Header("تنظیمات انیمیشن زنده و تعامل")]
        public float breathingSpeed = 2.1f;
        public float breathingAmplitude = 0.028f;
        public float idleSwayAmplitude = 3.5f;
        public float blinkInterval = 3.6f;

        private Transform characterRoot;
        private Transform chestTorso;
        private Transform headTransform;
        private Transform leftEyelid;
        private Transform rightEyelid;
        private Transform rightArmGroup;
        private Transform leftArmGroup;
        private Light forgeFireLight;
        private Light lanternLight;

        private float blinkTimer;
        private float blinkDurationTimer;
        private float reactionTimer;
        private float userYawOffset;
        private Vector3 baseChestScale = Vector3.one;

        public void BuildStageAndCharacter()
        {
            // پاک‌سازی فرزندان قبلی در صورت بازسازی
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }

            Shader std = Shader.Find("Universal Render Pipeline/Lit");
            if (std == null) std = Shader.Find("Standard");

            Material stoneWallMat = CreatePBRMat(std, new Color(0.16f, 0.13f, 0.11f), 0.1f, 0.25f);
            Material darkIronMat = CreatePBRMat(std, new Color(0.22f, 0.23f, 0.26f), 0.85f, 0.45f);
            Material brightSteelMat = CreatePBRMat(std, new Color(0.68f, 0.71f, 0.76f), 0.92f, 0.65f);
            Material brassGoldMat = CreatePBRMat(std, new Color(0.85f, 0.64f, 0.22f), 0.88f, 0.6f);
            Material leatherApronMat = CreatePBRMat(std, new Color(0.36f, 0.19f, 0.10f), 0.08f, 0.35f);
            Material darkLeatherMat = CreatePBRMat(std, new Color(0.20f, 0.12f, 0.07f), 0.12f, 0.4f);
            Material tunicClothMat = CreatePBRMat(std, new Color(0.14f, 0.16f, 0.20f), 0.05f, 0.2f);
            Material skinMat = CreatePBRMat(std, new Color(0.78f, 0.56f, 0.44f), 0.05f, 0.35f);
            Material beardHairMat = CreatePBRMat(std, new Color(0.24f, 0.14f, 0.09f), 0.1f, 0.25f);
            Material forgeEmberMat = CreatePBRMat(std, new Color(1.0f, 0.42f, 0.05f), 0.0f, 0.5f, new Color(2.4f, 0.75f, 0.08f));

            // ۱. محیط کارگاه آهنگری (دیوار سنگی، کوره روشن در چپ، فانوس آویز و سندان در پیش‌زمینه)
            Transform envGroup = new GameObject("Blacksmith_Forge_Environment_3D").transform;
            envGroup.SetParent(transform, false);

            CreatePart(PrimitiveType.Cube, "StoneWall_Back", envGroup, new Vector3(0f, 1.5f, 2.2f), new Vector3(6.5f, 5.5f, 0.4f), stoneWallMat);
            CreatePart(PrimitiveType.Cube, "Forge_Furnace_Arch", envGroup, new Vector3(-1.45f, 1.1f, 1.4f), new Vector3(2.2f, 2.8f, 1.2f), stoneWallMat);
            CreatePart(PrimitiveType.Sphere, "Forge_GlowingCoals", envGroup, new Vector3(-1.45f, 0.85f, 0.95f), new Vector3(1.35f, 0.9f, 0.6f), forgeEmberMat);

            // نور نارنجی و طلایی کوره
            GameObject fireLightGO = new GameObject("Forge_VolumetricFireLight");
            fireLightGO.transform.SetParent(envGroup, false);
            fireLightGO.transform.localPosition = new Vector3(-1.2f, 1.25f, 0.4f);
            forgeFireLight = fireLightGO.AddComponent<Light>();
            forgeFireLight.type = LightType.Point;
            forgeFireLight.color = new Color(1.0f, 0.52f, 0.14f);
            forgeFireLight.intensity = 3.8f;
            forgeFireLight.range = 8.5f;

            // فانوس آویز بالا
            CreatePart(PrimitiveType.Cylinder, "HangingLantern_Body", envGroup, new Vector3(0.55f, 2.85f, 0.6f), new Vector3(0.28f, 0.25f, 0.28f), brassGoldMat);
            GameObject lanternLightGO = new GameObject("Lantern_WarmLight");
            lanternLightGO.transform.SetParent(envGroup, false);
            lanternLightGO.transform.localPosition = new Vector3(0.55f, 2.65f, 0.4f);
            lanternLight = lanternLightGO.AddComponent<Light>();
            lanternLight.type = LightType.Point;
            lanternLight.color = new Color(1.0f, 0.78f, 0.42f);
            lanternLight.intensity = 2.1f;
            lanternLight.range = 6.0f;

            // سندان فولادی و چکش در پیش‌زمینه سمت چپ (مطابق تصویر مرجع)
            Transform anvilGroup = new GameObject("Foreground_Anvil_3D").transform;
            anvilGroup.SetParent(envGroup, false);
            anvilGroup.localPosition = new Vector3(-0.95f, -0.55f, -0.65f);
            CreatePart(PrimitiveType.Cube, "Anvil_BaseBlock", anvilGroup, new Vector3(0f, 0.25f, 0f), new Vector3(0.95f, 0.5f, 0.65f), darkIronMat);
            CreatePart(PrimitiveType.Cube, "Anvil_TopFace", anvilGroup, new Vector3(0f, 0.62f, 0f), new Vector3(1.25f, 0.28f, 0.52f), brightSteelMat);
            CreatePart(PrimitiveType.Cylinder, "Anvil_Horn", anvilGroup, new Vector3(0.72f, 0.62f, 0f), new Vector3(0.24f, 0.35f, 0.24f), brightSteelMat).localRotation = Quaternion.Euler(0f, 0f, 90f);

            // ۲. شخصیت سه‌بعدی آهنگر (کاوه)
            characterRoot = new GameObject("Blacksmith_Character_3D").transform;
            characterRoot.SetParent(transform, false);
            characterRoot.localPosition = new Vector3(-0.15f, -0.35f, 0.2f);
            characterRoot.localRotation = Quaternion.Euler(0f, 168f, 0f);

            if (customBlacksmithPrefab != null)
            {
                GameObject inst = Instantiate(customBlacksmithPrefab, characterRoot);
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                chestTorso = inst.transform;
                headTransform = inst.transform;
                return;
            }

            Debug.Log("[BlacksmithCharacter3D] مدل FBX خارجی تخصیص داده نشده است؛ ساخت مدل سه‌بعدی رویه‌ای آهنگر با پیش‌بند چرمی، دستکش، کمربند ابزار و انیمیشن زنده.");

            // تنه و پیراهن تیره آهنگری + پیش‌بند چرمی ضخیم و بندها
            chestTorso = CreatePart(PrimitiveType.Cylinder, "Torso_Tunic", characterRoot, new Vector3(0f, 1.15f, 0f), new Vector3(0.78f, 0.68f, 0.48f), tunicClothMat);
            baseChestScale = chestTorso.localScale;

            CreatePart(PrimitiveType.Cube, "Leather_Apron_Front", chestTorso, new Vector3(0f, -0.08f, 0.42f), new Vector3(0.76f, 0.92f, 0.16f), leatherApronMat);
            CreatePart(PrimitiveType.Cube, "Apron_Strap_L", chestTorso, new Vector3(-0.24f, 0.38f, 0.36f), new Vector3(0.12f, 0.42f, 0.18f), darkLeatherMat);
            CreatePart(PrimitiveType.Cube, "Apron_Strap_R", chestTorso, new Vector3(0.24f, 0.38f, 0.36f), new Vector3(0.12f, 0.42f, 0.18f), darkLeatherMat);
            CreatePart(PrimitiveType.Sphere, "Brass_Buckle_L", chestTorso, new Vector3(-0.24f, 0.25f, 0.48f), new Vector3(0.11f, 0.11f, 0.08f), brassGoldMat);
            CreatePart(PrimitiveType.Sphere, "Brass_Buckle_R", chestTorso, new Vector3(0.24f, 0.25f, 0.48f), new Vector3(0.11f, 0.11f, 0.08f), brassGoldMat);

            // کمربند ابزار چرمی و ابزارهای فلزی آویز
            CreatePart(PrimitiveType.Cylinder, "ToolBelt", chestTorso, new Vector3(0f, -0.28f, 0.04f), new Vector3(1.06f, 0.12f, 1.08f), darkLeatherMat);
            CreatePart(PrimitiveType.Cube, "BeltBuckle_Gold", chestTorso, new Vector3(0f, -0.28f, 0.54f), new Vector3(0.18f, 0.16f, 0.08f), brassGoldMat);
            CreatePart(PrimitiveType.Cube, "BeltPouch_Side", chestTorso, new Vector3(0.42f, -0.36f, 0.32f), new Vector3(0.18f, 0.24f, 0.18f), darkLeatherMat);
            CreatePart(PrimitiveType.Cylinder, "HangingTongs_Tool", chestTorso, new Vector3(-0.44f, -0.45f, 0.28f), new Vector3(0.06f, 0.25f, 0.06f), brightSteelMat);

            // بازوهای عضلانی و دستکش‌های چرمی ضخیم (حالت دست‌به‌سینه مطابق تصویر مرجع)
            leftArmGroup = new GameObject("LeftArm_Group").transform;
            leftArmGroup.SetParent(chestTorso, false);
            leftArmGroup.localPosition = new Vector3(-0.56f, 0.22f, 0.12f);
            CreatePart(PrimitiveType.Cylinder, "UpperArm_L", leftArmGroup, new Vector3(0f, -0.14f, 0.08f), new Vector3(0.28f, 0.26f, 0.28f), skinMat);
            CreatePart(PrimitiveType.Cylinder, "Gauntlet_L", leftArmGroup, new Vector3(0.28f, -0.22f, 0.34f), new Vector3(0.24f, 0.28f, 0.24f), darkLeatherMat).localRotation = Quaternion.Euler(0f, 0f, 78f);

            rightArmGroup = new GameObject("RightArm_Group").transform;
            rightArmGroup.SetParent(chestTorso, false);
            rightArmGroup.localPosition = new Vector3(0.56f, 0.22f, 0.12f);
            CreatePart(PrimitiveType.Cylinder, "UpperArm_R", rightArmGroup, new Vector3(0f, -0.14f, 0.08f), new Vector3(0.28f, 0.26f, 0.28f), skinMat);
            CreatePart(PrimitiveType.Cylinder, "Gauntlet_R", rightArmGroup, new Vector3(-0.28f, -0.18f, 0.38f), new Vector3(0.24f, 0.28f, 0.24f), darkLeatherMat).localRotation = Quaternion.Euler(0f, 0f, -78f);

            // سر، چهره، ریش پرپشت، مو، سربند آهنگری و پلک‌های متحرک
            headTransform = new GameObject("Blacksmith_Head_Group").transform;
            headTransform.SetParent(characterRoot, false);
            headTransform.localPosition = new Vector3(0f, 2.02f, 0.04f);

            CreatePart(PrimitiveType.Sphere, "Head_Skull", headTransform, Vector3.zero, new Vector3(0.46f, 0.54f, 0.48f), skinMat);
            CreatePart(PrimitiveType.Cylinder, "Headband_LeatherIron", headTransform, new Vector3(0f, 0.14f, 0.01f), new Vector3(0.48f, 0.06f, 0.50f), darkIronMat);
            CreatePart(PrimitiveType.Sphere, "Beard_Full", headTransform, new Vector3(0f, -0.15f, 0.10f), new Vector3(0.44f, 0.36f, 0.40f), beardHairMat);
            CreatePart(PrimitiveType.Sphere, "Hair_Back", headTransform, new Vector3(0f, 0.04f, -0.10f), new Vector3(0.48f, 0.50f, 0.42f), beardHairMat);

            leftEyelid = CreatePart(PrimitiveType.Sphere, "Eye_L", headTransform, new Vector3(-0.09f, 0.04f, 0.22f), new Vector3(0.055f, 0.045f, 0.03f), darkIronMat);
            rightEyelid = CreatePart(PrimitiveType.Sphere, "Eye_R", headTransform, new Vector3(0.09f, 0.04f, 0.22f), new Vector3(0.055f, 0.045f, 0.03f), darkIronMat);
        }

        private void Update()
        {
            if (characterRoot == null) return;

            float t = Time.unscaledTime;

            // ۱. انیمیشن تنفس طبیعی قفسه سینه
            if (chestTorso != null)
            {
                float breath = Mathf.Sin(t * breathingSpeed) * breathingAmplitude;
                chestTorso.localScale = new Vector3(
                    baseChestScale.x * (1f + breath * 0.6f),
                    baseChestScale.y * (1f + breath),
                    baseChestScale.z * (1f + breath * 0.8f)
                );
            }

            // ۲. حرکت جزئی سر و بدن + واکنش به تعامل بازیکن
            float reactNod = 0f;
            if (reactionTimer > 0f)
            {
                reactionTimer = Mathf.Max(0f, reactionTimer - Time.unscaledDeltaTime);
                reactNod = Mathf.Sin(reactionTimer * 18f) * 8f;
            }

            if (headTransform != null)
            {
                float headPitch = Mathf.Sin(t * 1.1f) * 2.2f + reactNod;
                float headYaw = Mathf.Cos(t * 0.75f) * idleSwayAmplitude;
                headTransform.localRotation = Quaternion.Euler(headPitch, headYaw, 0f);
            }

            characterRoot.localRotation = Quaternion.Euler(0f, 168f + Mathf.Sin(t * 0.6f) * 2.5f + userYawOffset, 0f);

            // ۳. پلک‌زدن طبیعی دوره‌ای
            blinkTimer += Time.unscaledDeltaTime;
            if (blinkTimer >= blinkInterval)
            {
                blinkDurationTimer = 0.14f;
                blinkTimer = 0f;
            }

            if (leftEyelid != null && rightEyelid != null)
            {
                float eyeY = blinkDurationTimer > 0f ? 0.008f : 0.045f;
                if (blinkDurationTimer > 0f) blinkDurationTimer -= Time.unscaledDeltaTime;
                leftEyelid.localScale = new Vector3(0.055f, eyeY, 0.03f);
                rightEyelid.localScale = new Vector3(0.055f, eyeY, 0.03f);
            }

            // ۴. سوسو زدن طبیعی نور کوره آهنگری
            if (forgeFireLight != null)
            {
                forgeFireLight.intensity = 3.6f + Mathf.Sin(t * 11.5f) * 0.45f + Mathf.Cos(t * 19.3f) * 0.25f;
            }
        }

        public void RotateCharacter(float deltaDegrees)
        {
            userYawOffset = Mathf.Clamp(userYawOffset + deltaDegrees, -45f, 45f);
        }

        public void TriggerInteractionReaction()
        {
            reactionTimer = 0.45f;
        }

        private Transform CreatePart(PrimitiveType type, string partName, Transform parent, Vector3 localPos, Vector3 localScale, Material mat)
        {
            GameObject go = GameObject.CreatePrimitive(type);
            go.name = partName;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = localScale;
            Collider col = go.GetComponent<Collider>();
            if (col != null) DestroyImmediate(col);
            Renderer r = go.GetComponent<Renderer>();
            if (r != null && mat != null) r.sharedMaterial = mat;
            return go.transform;
        }

        private Material CreatePBRMat(Shader shader, Color albedo, float metallic, float smoothness, Color emission = default)
        {
            Material m = new Material(shader);
            m.color = albedo;
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smoothness);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            if (emission != default)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", emission);
            }
            return m;
        }
    }
}
