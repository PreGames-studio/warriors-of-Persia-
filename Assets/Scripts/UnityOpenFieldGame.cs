using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using WarriorsOfPersia.Blacksmith;

/// <summary>Builds the Unity mobile prototype: Persian swordsman, open field and touch HUD.</summary>
public sealed class UnityOpenFieldGame : MonoBehaviour
{
    private const float FieldExtent = 70f;
    private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
    private readonly System.Random random = new System.Random(2319);
    private SwordsmanController hero;
    private Text statusText;
    private BlacksmithMaterialLibrary environmentMaterials;
    private bool highQuality;

    private void Start()
    {
        Application.targetFrameRate = 60;
        Screen.sleepTimeout = SleepTimeout.NeverSleep;
        // No physical device is available in this environment; use a
        // conservative 1 GB mobile threshold instead of forcing every GPU
        // through 2K textures, depth AO and high-resolution shadow passes.
        highQuality = !Application.isMobilePlatform || SystemInfo.graphicsMemorySize >= 1024;
        QualitySettings.antiAliasing = highQuality ? 4 : 2;
        QualitySettings.pixelLightCount = highQuality ? 5 : 3;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = highQuality ? ShadowResolution.VeryHigh : ShadowResolution.High;
        QualitySettings.shadowDistance = highQuality ? 72f : 48f;
        QualitySettings.shadowCascades = highQuality ? 2 : 1;
        QualitySettings.shadowProjection = ShadowProjection.StableFit;
        QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;
        QualitySettings.masterTextureLimit = highQuality ? 0 : 1;
        QualitySettings.lodBias = highQuality ? 1.2f : .85f;
        environmentMaterials = new BlacksmithMaterialLibrary();

        BuildLighting();
        BuildGroundAndPaths();
        BuildDistantHills();
        BuildFoliage();
        BuildVillageGate();
        BuildBlacksmithDistrict();
        BuildHero();
        hero.SetCameraYaw(24f); // Three-quarter opening view of the forge, while keeping free touch look.
        BuildTrainingTargets();
        BuildTouchInterface();
    }

    private void BuildLighting()
    {
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(.36f, .45f, .62f);
        RenderSettings.ambientEquatorColor = new Color(.25f, .29f, .34f);
        RenderSettings.ambientGroundColor = new Color(.12f, .14f, .15f);
        RenderSettings.ambientLight = new Color(.25f, .32f, .43f);
        RenderSettings.ambientIntensity = .78f;
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(.085f, .125f, .19f);
        RenderSettings.fogMode = FogMode.Linear;
        RenderSettings.fogStartDistance = 58f;
        RenderSettings.fogEndDistance = 155f;
        BuildReflectionEnvironment();

        GameObject sunObject = new GameObject("Blue hour moonlight");
        Light sun = sunObject.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.color = new Color(.57f, .67f, .86f);
        sun.intensity = .72f;
        sun.shadows = LightShadows.Soft;
        sun.shadowBias = .035f;
        sun.shadowNormalBias = .35f;
        sun.shadowStrength = .84f;
        sunObject.transform.rotation = Quaternion.Euler(34f, -28f, 0f);

        GameObject cameraObject = new GameObject("Mobile third-person camera");
        Camera camera = cameraObject.AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = RenderSettings.fogColor;
        camera.fieldOfView = 62f;
        camera.nearClipPlane = .08f;
        camera.farClipPlane = 180f;
        camera.allowHDR = true;
        camera.allowMSAA = true;
        cameraObject.AddComponent<AudioListener>();
        CinematicPostProcess postProcess = cameraObject.AddComponent<CinematicPostProcess>();
        postProcess.Configure(highQuality);
        _camera = camera;
    }

    private void BuildReflectionEnvironment()
    {
        const int reflectionSize = 64;
        Cubemap reflection = new Cubemap(reflectionSize, TextureFormat.RGBA32, true);
        Color sky = new Color(.11f, .17f, .27f);
        Color horizon = new Color(.31f, .29f, .27f);
        Color ground = new Color(.055f, .06f, .07f);
        for (int faceIndex = 0; faceIndex < 6; faceIndex++)
        {
            CubemapFace face = (CubemapFace)faceIndex;
            Color[] pixels = new Color[reflectionSize * reflectionSize];
            for (int y = 0; y < reflectionSize; y++)
            {
                float vertical = face == CubemapFace.PositiveY ? 1f : face == CubemapFace.NegativeY ? 0f : 1f - y / (reflectionSize - 1f);
                Color value = vertical > .52f ? Color.Lerp(horizon, sky, (vertical - .52f) / .48f) : Color.Lerp(ground, horizon, vertical / .52f);
                for (int x = 0; x < reflectionSize; x++) pixels[y * reflectionSize + x] = value;
            }
            reflection.SetPixels(pixels, face);
        }
        reflection.Apply(true);
        RenderSettings.customReflection = reflection;
        RenderSettings.defaultReflectionMode = UnityEngine.Rendering.DefaultReflectionMode.Custom;
        RenderSettings.reflectionIntensity = .68f;
    }

    private Camera _camera;

    private void BuildGroundAndPaths()
    {
        CreatePrimitive("Open green meadow", PrimitiveType.Cube, transform,
            new Vector3(0f, -0.12f, 0f), new Vector3(146f, 0.24f, 146f), environmentMaterials.Get("Grass"), true);
        BuildTerrainSurface();

        Material[] patchMaterials =
        {
            environmentMaterials.Get("Grass"), environmentMaterials.Get("GrassDry"),
            environmentMaterials.Get("GrassDark"), environmentMaterials.Get("Grass")
        };
        for (int i = 0; i < 34; i++)
        {
            Vector2 point = RandomPoint(64f);
            if (NearTrail(point, 7f))
                continue;
            float width = Range(3.5f, 8f);
            float depth = Range(3f, 7.5f);
            CreatePrimitive("Soft grass variation", PrimitiveType.Cube, transform,
                new Vector3(point.x, 0.015f, point.y), new Vector3(width, 0.025f, depth),
                patchMaterials[i % patchMaterials.Length], false);
        }

        Material trailEdge = environmentMaterials.Get("StoneDark");
        Material trailEarth = environmentMaterials.Get("Earth");
        Material trailStone = environmentMaterials.Get("CobbleBlock");
        AddTrail(new Vector2(0f, -66f), new Vector2(0f, 66f), 5.2f, 0.055f, trailEdge);
        AddTrail(new Vector2(0f, -66f), new Vector2(0f, 66f), 4.4f, 0.065f, trailEarth);
        AddTrail(new Vector2(0f, 18f), new Vector2(-55f, 66f), 3.6f, 0.05f, trailEarth);
        AddTrail(new Vector2(0f, 18f), new Vector2(55f, 66f), 3.6f, 0.05f, trailEarth);
        AddTrail(new Vector2(-4f, -4f), new Vector2(-66f, -30f), 3.4f, 0.045f, trailEarth);

        for (int i = 0; i < 38; i++)
        {
            float z = -60f + i * 3.1f;
            Vector3 stonePosition = new Vector3(Range(-1.2f, 1.2f), 0.035f, z);
            Vector3 stoneScale = new Vector3(Range(1.1f, 2.7f), 0.045f, Range(0.6f, 1.35f));
            CreatePrimitive("Path stone", PrimitiveType.Cube, transform,
                stonePosition, stoneScale, trailStone, false);
        }

        BuildInvisibleBoundary();
    }

    private void BuildTerrainSurface()
    {
        const int resolution = 48;
        const float extent = 73f;
        List<Vector3> vertices = new List<Vector3>((resolution + 1) * (resolution + 1));
        List<Vector2> uv = new List<Vector2>(vertices.Capacity);
        List<int> triangles = new List<int>(resolution * resolution * 6);
        for (int z = 0; z <= resolution; z++)
        for (int x = 0; x <= resolution; x++)
        {
            float worldX = -extent + x * (extent * 2f / resolution);
            float worldZ = -extent + z * (extent * 2f / resolution);
            float height = (Mathf.PerlinNoise(worldX * .075f, worldZ * .075f) - .5f) * .035f;
            vertices.Add(new Vector3(worldX, .006f + height, worldZ));
            uv.Add(new Vector2(x / (float)resolution, z / (float)resolution));
        }
        for (int z = 0; z < resolution; z++)
        for (int x = 0; x < resolution; x++)
        {
            int start = z * (resolution + 1) + x;
            triangles.Add(start); triangles.Add(start + resolution + 1); triangles.Add(start + 1);
            triangles.Add(start + 1); triangles.Add(start + resolution + 1); triangles.Add(start + resolution + 2);
        }
        Mesh mesh = new Mesh { name = "Subtle continuous meadow surface" };
        mesh.SetVertices(vertices);
        mesh.SetUVs(0, uv);
        mesh.SetTriangles(triangles, 0, true);
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        GameObject surface = new GameObject("2K meadow surface • collision retained on base");
        surface.transform.SetParent(transform, false);
        surface.AddComponent<MeshFilter>().sharedMesh = mesh;
        surface.AddComponent<MeshRenderer>().sharedMaterial = environmentMaterials.Get("Grass");
    }

    private void AddTrail(Vector2 start, Vector2 end, float width, float height, Material material)
    {
        Vector2 delta = end - start;
        Vector2 mid = (start + end) * 0.5f;
        float yaw = -Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
        CreatePrimitive("Open-world trail", PrimitiveType.Cube, transform,
            new Vector3(mid.x, height * 0.5f + 0.005f, mid.y),
            new Vector3(delta.magnitude, height, width), material, false,
            Quaternion.Euler(0f, yaw, 0f));
    }

    private void BuildInvisibleBoundary()
    {
        float edge = FieldExtent + 3f;
        AddWall(new Vector3(0f, 2f, edge), new Vector3(146f, 4f, 1f));
        AddWall(new Vector3(-edge, 2f, 0f), new Vector3(1f, 4f, 146f));
        AddWall(new Vector3(edge, 2f, 0f), new Vector3(1f, 4f, 146f));
        // Leave a clear northern trail exit for later expansion of the open world.
        AddWall(new Vector3(-38.5f, 2f, -edge), new Vector3(69f, 4f, 1f));
        AddWall(new Vector3(38.5f, 2f, -edge), new Vector3(69f, 4f, 1f));
    }

    private void AddWall(Vector3 position, Vector3 size)
    {
        GameObject wall = new GameObject("Invisible world boundary");
        wall.transform.SetParent(transform, false);
        wall.transform.localPosition = position;
        BoxCollider collider = wall.AddComponent<BoxCollider>();
        collider.size = size;
    }

    private void BuildDistantHills()
    {
        Material[] greens = { Mat("#4d7a43", 1f), Mat("#588448", 1f), Mat("#668e50", 1f) };
        for (int i = 0; i < 22; i++)
        {
            float side = i % 2 == 0 ? -1f : 1f;
            float z = -69f + (i / 2) * 6.3f;
            float x = side * Range(64f, 69f);
            CreatePrimitive("Soft distant hill", PrimitiveType.Sphere, transform,
                new Vector3(x, -0.35f, z), new Vector3(Range(8f, 15f), 2.3f, Range(8f, 17f)),
                greens[i % greens.Length], false);
        }
    }

    private void BuildFoliage()
    {
        Mesh bladeMesh = CreateGrassBladeMesh();
        Material[] bladeMaterials = { Mat("#75a755", 0.95f), Mat("#83b45d", 0.95f), Mat("#4f8043", 0.95f) };
        List<Matrix4x4>[] grass = { new List<Matrix4x4>(), new List<Matrix4x4>(), new List<Matrix4x4>() };
        for (int i = 0; i < 1700; i++)
        {
            Vector2 point = RandomPoint(65f);
            if (NearTrail(point, 3.6f))
                continue;
            float scale = Range(0.6f, 1.5f);
            float yaw = Range(0f, 360f);
            Matrix4x4 matrix = Matrix4x4.TRS(
                new Vector3(point.x, 0.11f * scale, point.y),
                Quaternion.Euler(0f, yaw, Range(-7f, 7f)),
                new Vector3(0.045f * scale, 0.23f * scale, 0.035f * scale));
            grass[i % grass.Length].Add(matrix);
        }
        for (int i = 0; i < grass.Length; i++)
            AddFoliageBatch("Grass blades " + i, bladeMesh, bladeMaterials[i], grass[i]);

        Mesh shrubMesh = PrimitiveMesh(PrimitiveType.Sphere);
        Material[] shrubMaterials = { Mat("#397342", 0.98f), Mat("#4b8545", 0.98f), Mat("#5a9149", 0.98f) };
        List<Matrix4x4>[] shrubs = { new List<Matrix4x4>(), new List<Matrix4x4>(), new List<Matrix4x4>() };
        int placed = 0;
        int attempts = 0;
        while (placed < 110 && attempts < 1000)
        {
            attempts++;
            Vector2 point = RandomPoint(62f);
            if (NearTrail(point, 7.2f) || Vector2.Distance(point, new Vector2(0f, -41f)) < 10f)
                continue;

            float radius = Range(0.45f, 0.95f);
            float height = radius * Range(0.72f, 1f);
            int colorIndex = placed % shrubs.Length;
            Matrix4x4 matrix = Matrix4x4.TRS(
                new Vector3(point.x, height, point.y),
                Quaternion.Euler(0f, Range(0f, 360f), 0f),
                new Vector3(radius * 2f, height * 2f, radius * 2f));
            shrubs[colorIndex].Add(matrix);
            AddBushCollider(point, radius);
            placed++;
        }
        for (int i = 0; i < shrubs.Length; i++)
            AddFoliageBatch("Field shrubs " + i, shrubMesh, shrubMaterials[i], shrubs[i]);
    }

    private Mesh CreateGrassBladeMesh()
    {
        List<Vector3> vertices = new List<Vector3>();
        List<Vector2> uv = new List<Vector2>();
        List<int> triangles = new List<int>();
        for (int blade = 0; blade < 3; blade++)
        {
            float angle = blade * Mathf.PI / 3f;
            Vector3 right = new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle)) * .5f;
            Vector3 bend = new Vector3(Mathf.Sin(angle), 0f, -Mathf.Cos(angle)) * .16f;
            int start = vertices.Count;
            vertices.Add(-right); vertices.Add(right);
            vertices.Add(right * .55f + Vector3.up * .62f + bend);
            vertices.Add(Vector3.up + bend * 1.5f);
            uv.Add(new Vector2(0f, 0f)); uv.Add(new Vector2(1f, 0f));
            uv.Add(new Vector2(1f, .62f)); uv.Add(new Vector2(.5f, 1f));
            triangles.Add(start); triangles.Add(start + 2); triangles.Add(start + 1);
            triangles.Add(start); triangles.Add(start + 3); triangles.Add(start + 2);
            triangles.Add(start + 1); triangles.Add(start + 2); triangles.Add(start + 3);
        }
        Mesh mesh = new Mesh { name = "Tapered crossed meadow blades" };
        mesh.SetVertices(vertices);
        mesh.SetUVs(0, uv);
        mesh.SetTriangles(triangles, 0, true);
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return mesh;
    }

    private void AddFoliageBatch(string objectName, Mesh mesh, Material material, List<Matrix4x4> matrices)
    {
        GameObject batchObject = new GameObject(objectName);
        batchObject.transform.SetParent(transform, false);
        FoliageBatch batch = batchObject.AddComponent<FoliageBatch>();
        batch.Configure(mesh, material, matrices);
    }

    private void AddBushCollider(Vector2 position, float radius)
    {
        GameObject obstacle = new GameObject("Bush collision");
        obstacle.transform.SetParent(transform, false);
        obstacle.transform.localPosition = new Vector3(position.x, radius * 0.48f, position.y);
        SphereCollider collider = obstacle.AddComponent<SphereCollider>();
        collider.radius = radius * 0.85f;
    }

    private void BuildVillageGate()
    {
        const float z = -66f;
        Transform villageRoot = new GameObject("Detailed village gate district").transform;
        villageRoot.SetParent(transform, false);
        MedievalVillageBuilder.CreateGate(villageRoot, z);
        MedievalVillageBuilder.CreateHouse(villageRoot, new Vector3(-10f, 0f, -72f), new Vector3(7f, 4f, 6f), false);
        MedievalVillageBuilder.CreateHouse(villageRoot, new Vector3(10f, 0f, -73f), new Vector3(6f, 4f, 6f), true);
        if (Application.isPlaying) StaticBatchingUtility.Combine(villageRoot.gameObject);

        GameObject sign = new GameObject("Village sign");
        sign.transform.SetParent(transform, false);
        sign.transform.localPosition = new Vector3(0f, 5.3f, -67f);
        TextMesh textMesh = sign.AddComponent<TextMesh>();
        textMesh.text = "VILLAGE";
        textMesh.anchor = TextAnchor.MiddleCenter;
        textMesh.alignment = TextAlignment.Center;
        textMesh.fontSize = 48;
        textMesh.characterSize = 0.09f;
        textMesh.color = new Color(1f, 0.92f, 0.72f);
    }

    private void BuildBlacksmithDistrict()
    {
        MedievalBlacksmithBuilder builder = GetComponentInChildren<MedievalBlacksmithBuilder>();
        if (builder == null)
        {
            GameObject district = new GameObject("Kaveh's medieval blacksmith district");
            district.transform.SetParent(transform, false);
            builder = district.AddComponent<MedievalBlacksmithBuilder>();
        }
        // The open doorway faces the initial approach; the central village trail remains unobstructed.
        builder.Build(new Vector3(12f, 0f, -30f), 180f);
        if (builder.Door != null)
        {
            builder.Door.StatusChanged += message =>
            {
                if (statusText != null) statusText.text = message;
            };
        }
    }

    private void BuildHero()
    {
        GameObject heroObject = new GameObject("Persian sword hero");
        heroObject.transform.SetParent(transform, false);
        heroObject.transform.position = new Vector3(0f, 0.02f, -42f);

        CharacterController character = heroObject.AddComponent<CharacterController>();
        character.height = 1.85f;
        character.radius = 0.34f;
        character.center = new Vector3(0f, 0.94f, 0f);
        character.stepOffset = 0.25f;
        character.slopeLimit = 48f;
        character.skinWidth = 0.06f;

        hero = heroObject.AddComponent<SwordsmanController>();

        Material skin = Mat("#dfa77d", 0.75f);
        Material tunic = Mat("#246d73", 0.82f);
        Material trim = Mat("#53a394", 0.65f);
        Material leather = Mat("#63402b", 0.9f);
        Material bronze = Mat("#bd8741", 0.5f);
        Material gold = Mat("#f0c76f", 0.38f);
        Material capeMaterial = Mat("#8e3340", 0.82f);
        Material boots = Mat("#392b29", 0.86f);
        Material steel = Mat("#cbd9dc", 0.28f);
        Material edge = Mat("#f4f4e4", 0.22f);
        Material eye = Mat("#291e1b", 0.55f);

        Transform visual = NewChild("Hero visual", heroObject.transform);
        CreatePrimitive("Tunic", PrimitiveType.Capsule, visual, new Vector3(0f, 1.2f, 0f),
            new Vector3(0.67f, 0.55f, 0.52f), tunic, false);
        CreatePrimitive("Tunic hem", PrimitiveType.Cube, visual, new Vector3(0f, 0.88f, 0f),
            new Vector3(0.52f, 0.1f, 0.38f), trim, false);
        CreatePrimitive("Leather belt", PrimitiveType.Cube, visual, new Vector3(0f, 1f, 0f),
            new Vector3(0.49f, 0.095f, 0.35f), leather, false);
        CreatePrimitive("Belt buckle", PrimitiveType.Cube, visual, new Vector3(0f, 1f, 0.19f),
            new Vector3(0.11f, 0.11f, 0.04f), gold, false);
        Transform cape = CreatePrimitive("Short red cape", PrimitiveType.Cube, visual,
            new Vector3(0f, 1.27f, -0.22f), new Vector3(0.52f, 0.72f, 0.09f), capeMaterial, false).transform;

        CreatePrimitive("Face", PrimitiveType.Sphere, visual, new Vector3(0f, 1.88f, 0.015f),
            new Vector3(0.5f, 0.57f, 0.48f), skin, false);
        CreatePrimitive("Bronze helmet", PrimitiveType.Sphere, visual, new Vector3(0f, 2.1f, 0f),
            new Vector3(0.58f, 0.34f, 0.54f), bronze, false);
        CreatePrimitive("Helmet band", PrimitiveType.Cube, visual, new Vector3(0f, 2.02f, 0.04f),
            new Vector3(0.53f, 0.07f, 0.4f), gold, false);
        CreatePrimitive("Red helmet crest", PrimitiveType.Cube, visual, new Vector3(0f, 2.3f, 0f),
            new Vector3(0.1f, 0.2f, 0.1f), capeMaterial, false);
        CreatePrimitive("Eye left", PrimitiveType.Sphere, visual, new Vector3(-0.09f, 1.9f, 0.245f),
            new Vector3(0.055f, 0.07f, 0.025f), eye, false);
        CreatePrimitive("Eye right", PrimitiveType.Sphere, visual, new Vector3(0.09f, 1.9f, 0.245f),
            new Vector3(0.055f, 0.07f, 0.025f), eye, false);

        Transform leftLeg = BuildLeg(visual, "Left leg", -0.17f, tunic, boots);
        Transform rightLeg = BuildLeg(visual, "Right leg", 0.17f, tunic, boots);
        Transform leftArm = BuildArm(visual, "Left arm", -0.39f, skin, bronze);
        Transform rightArm = BuildArm(visual, "Right arm", 0.39f, skin, bronze);
        leftArm.localRotation = Quaternion.Euler(-8f, 0f, 12f);
        rightArm.localRotation = Quaternion.Euler(-8f, 0f, -12f);

        Transform swordPivot = NewChild("Sword pivot", rightArm);
        swordPivot.localPosition = new Vector3(0.03f, -0.18f, 0.04f);
        CreatePrimitive("Sword grip", PrimitiveType.Cube, swordPivot, new Vector3(0f, -0.12f, 0f),
            new Vector3(0.09f, 0.25f, 0.09f), leather, false);
        CreatePrimitive("Sword pommel", PrimitiveType.Sphere, swordPivot, new Vector3(0f, -0.27f, 0f),
            new Vector3(0.12f, 0.12f, 0.12f), gold, false);
        CreatePrimitive("Sword guard", PrimitiveType.Cube, swordPivot, new Vector3(0f, -0.005f, 0f),
            new Vector3(0.34f, 0.08f, 0.1f), bronze, false);
        CreatePrimitive("Steel sword blade", PrimitiveType.Cube, swordPivot, new Vector3(0f, 0f, 0.48f),
            new Vector3(0.12f, 0.075f, 0.9f), steel, false);
        CreatePrimitive("Bright blade edge", PrimitiveType.Cube, swordPivot, new Vector3(-0.05f, 0.04f, 0.48f),
            new Vector3(0.02f, 0.012f, 0.72f), edge, false);

        hero.Configure(_camera, visual, leftLeg, rightLeg, leftArm, rightArm, swordPivot, cape);
    }

    private Transform BuildLeg(Transform parent, string name, float x, Material tunic, Material boots)
    {
        GameObject pivot = new GameObject(name);
        pivot.transform.SetParent(parent, false);
        pivot.transform.localPosition = new Vector3(x, 0.7f, 0f);
        CreatePrimitive(name + " cloth", PrimitiveType.Capsule, pivot.transform,
            new Vector3(0f, -0.25f, 0f), new Vector3(0.26f, 0.36f, 0.27f), tunic, false);
        CreatePrimitive(name + " boot", PrimitiveType.Cube, pivot.transform,
            new Vector3(0f, -0.53f, 0.08f), new Vector3(0.25f, 0.18f, 0.35f), boots, false);
        return pivot.transform;
    }

    private Transform BuildArm(Transform parent, string name, float x, Material skin, Material armor)
    {
        GameObject pivot = new GameObject(name);
        pivot.transform.SetParent(parent, false);
        pivot.transform.localPosition = new Vector3(x, 1.48f, 0f);
        CreatePrimitive(name + " sleeve", PrimitiveType.Capsule, pivot.transform,
            new Vector3(0f, -0.22f, 0f), new Vector3(0.22f, 0.31f, 0.23f), Mat("#246d73", 0.82f), false);
        CreatePrimitive(name + " hand", PrimitiveType.Sphere, pivot.transform,
            new Vector3(0f, -0.45f, 0.02f), new Vector3(0.18f, 0.17f, 0.18f), skin, false);
        CreatePrimitive(name + " shoulder guard", PrimitiveType.Sphere, pivot.transform,
            new Vector3(0f, -0.03f, 0f), new Vector3(0.35f, 0.28f, 0.34f), armor, false);
        return pivot.transform;
    }

    private void BuildTrainingTargets()
    {
        BuildTrainingDummy(new Vector3(-5.8f, 0f, -31f));
        BuildTrainingDummy(new Vector3(6f, 0f, -20f));
    }

    private void BuildTrainingDummy(Vector3 position)
    {
        GameObject root = new GameObject("Wooden sword-training target");
        root.transform.SetParent(transform, false);
        root.transform.position = position;
        CapsuleCollider collider = root.AddComponent<CapsuleCollider>();
        collider.center = new Vector3(0f, 1f, 0f);
        collider.radius = 0.38f;
        collider.height = 1.5f;
        Transform visual = NewChild("Visual", root.transform);
        Material wood = Mat("#765033", 0.9f);
        Material target = Mat("#d2ad68", 0.82f);
        CreatePrimitive("Body", PrimitiveType.Capsule, visual, new Vector3(0f, 1f, 0f),
            new Vector3(0.66f, 0.66f, 0.66f), wood, false);
        CreatePrimitive("Target marker", PrimitiveType.Sphere, visual, new Vector3(0f, 1.1f, 0.34f),
            new Vector3(0.28f, 0.28f, 0.12f), target, false);
        CreatePrimitive("Crossbar", PrimitiveType.Cube, visual, new Vector3(0f, 1.18f, 0f),
            new Vector3(1.2f, 0.12f, 0.14f), wood, false);
        CreatePrimitive("Stand", PrimitiveType.Cylinder, visual, new Vector3(0f, 0.2f, 0f),
            new Vector3(0.28f, 0.4f, 0.28f), Mat("#3d2c21", 0.95f), false);
        root.AddComponent<TrainingDummy>();
    }

    private void BuildTouchInterface()
    {
        if (FindObjectOfType<EventSystem>() == null)
        {
            GameObject eventObject = new GameObject("Touch Event System");
            eventObject.AddComponent<EventSystem>();
            eventObject.AddComponent<StandaloneInputModule>();
        }

        GameObject canvasObject = new GameObject("Mobile HUD", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        Canvas canvas = canvasObject.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 10;
        CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280f, 720f);
        scaler.matchWidthOrHeight = 0.5f;

        GameObject safeObject = new GameObject("Safe area", typeof(RectTransform));
        safeObject.transform.SetParent(canvasObject.transform, false);
        RectTransform safeRect = safeObject.GetComponent<RectTransform>();
        safeRect.anchorMin = Vector2.zero;
        safeRect.anchorMax = Vector2.one;
        safeRect.offsetMin = Vector2.zero;
        safeRect.offsetMax = Vector2.zero;
        safeObject.AddComponent<MobileSafeArea>();

        GameObject lookObject = CreateUIObject("Camera drag area", safeRect);
        RectTransform lookRect = lookObject.GetComponent<RectTransform>();
        StretchFullScreen(lookRect);
        Image lookImage = lookObject.AddComponent<Image>();
        lookImage.color = new Color(1f, 1f, 1f, 0f);
        lookImage.raycastTarget = true;
        MobileCameraDrag cameraDrag = lookObject.AddComponent<MobileCameraDrag>();
        cameraDrag.hero = hero;

        GameObject titleObject = CreateUIObject("Field title", safeRect);
        RectTransform titleRect = titleObject.GetComponent<RectTransform>();
        titleRect.anchorMin = new Vector2(0f, 1f);
        titleRect.anchorMax = new Vector2(0f, 1f);
        titleRect.pivot = new Vector2(0f, 1f);
        titleRect.anchoredPosition = new Vector2(28f, -24f);
        titleRect.sizeDelta = new Vector2(450f, 64f);
        Image titleBack = titleObject.AddComponent<Image>();
        titleBack.color = new Color(0.04f, 0.11f, 0.08f, 0.68f);
        titleBack.raycastTarget = false;
        Text title = AddText(titleObject.transform, "OPEN FIELD  •  VILLAGE EDGE", 28, TextAnchor.MiddleCenter);
        title.rectTransform.offsetMin = new Vector2(10f, 6f);
        title.rectTransform.offsetMax = new Vector2(-10f, -6f);

        GameObject joystickObject = CreateUIObject("Movement joystick", safeRect);
        RectTransform joystickRect = joystickObject.GetComponent<RectTransform>();
        joystickRect.anchorMin = Vector2.zero;
        joystickRect.anchorMax = Vector2.zero;
        joystickRect.pivot = new Vector2(0.5f, 0.5f);
        joystickRect.anchoredPosition = new Vector2(145f, 145f);
        joystickRect.sizeDelta = new Vector2(190f, 190f);
        Image joystickImage = joystickObject.AddComponent<Image>();
        joystickImage.sprite = CircleSprite;
        joystickImage.color = new Color(0.08f, 0.16f, 0.12f, 0.48f);
        joystickImage.raycastTarget = true;
        MobileVirtualJoystick virtualJoystick = joystickObject.AddComponent<MobileVirtualJoystick>();
        hero.BindJoystick(virtualJoystick);

        GameObject handleObject = CreateUIObject("Joystick thumb", joystickRect);
        RectTransform handleRect = handleObject.GetComponent<RectTransform>();
        handleRect.anchorMin = new Vector2(0.5f, 0.5f);
        handleRect.anchorMax = new Vector2(0.5f, 0.5f);
        handleRect.pivot = new Vector2(0.5f, 0.5f);
        handleRect.sizeDelta = new Vector2(78f, 78f);
        Image handleImage = handleObject.AddComponent<Image>();
        handleImage.sprite = CircleSprite;
        handleImage.color = new Color(0.82f, 0.72f, 0.48f, 0.88f);
        handleImage.raycastTarget = false;
        virtualJoystick.SetHandle(handleRect);

        CreateTouchAction(safeRect, hero, "RUN", MobileActionType.Run,
            new Vector2(310f, 112f), new Vector2(116f, 92f), false);
        CreateTouchAction(safeRect, hero, "SWORD", MobileActionType.SwordAttack,
            new Vector2(-136f, 148f), new Vector2(158f, 142f), true);

        GameObject statusObject = CreateUIObject("Combat feedback", safeRect);
        RectTransform statusRect = statusObject.GetComponent<RectTransform>();
        statusRect.anchorMin = new Vector2(0.5f, 0f);
        statusRect.anchorMax = new Vector2(0.5f, 0f);
        statusRect.pivot = new Vector2(0.5f, 0f);
        statusRect.anchoredPosition = new Vector2(0f, 28f);
        statusRect.sizeDelta = new Vector2(520f, 42f);
        statusText = AddText(statusObject.transform, "TOUCH TO MOVE  •  DRAG RIGHT SIDE TO LOOK", 18, TextAnchor.MiddleCenter);
        hero.SwordHit += damage => statusText.text = "SWORD HIT  •  DAMAGE " + Mathf.RoundToInt(damage);
    }

    private void CreateTouchAction(RectTransform parent, SwordsmanController controller, string label,
        MobileActionType type, Vector2 anchoredPosition, Vector2 size, bool larger)
    {
        GameObject buttonObject = CreateUIObject(label + " touch button", parent);
        RectTransform rect = buttonObject.GetComponent<RectTransform>();
        rect.anchorMin = type == MobileActionType.SwordAttack ? new Vector2(1f, 0f) : Vector2.zero;
        rect.anchorMax = rect.anchorMin;
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = anchoredPosition;
        rect.sizeDelta = size;
        Image image = buttonObject.AddComponent<Image>();
        image.sprite = CircleSprite;
        image.color = larger ? new Color(0.65f, 0.2f, 0.15f, 0.83f) : new Color(0.12f, 0.23f, 0.18f, 0.76f);
        image.raycastTarget = true;
        MobileActionButton action = buttonObject.AddComponent<MobileActionButton>();
        action.actionType = type;
        action.hero = controller;
        AddText(buttonObject.transform, label, larger ? 25 : 20, TextAnchor.MiddleCenter);
    }

    private static GameObject CreateUIObject(string name, Transform parent)
    {
        GameObject result = new GameObject(name, typeof(RectTransform));
        result.transform.SetParent(parent, false);
        return result;
    }

    private static void StretchFullScreen(RectTransform rect)
    {
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
    }

    private static Text AddText(Transform parent, string value, int size, TextAnchor alignment)
    {
        GameObject textObject = CreateUIObject("Text", parent);
        RectTransform rect = textObject.GetComponent<RectTransform>();
        StretchFullScreen(rect);
        Text text = textObject.AddComponent<Text>();
        text.text = value;
        text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        text.fontSize = size;
        text.alignment = alignment;
        text.color = Color.white;
        text.raycastTarget = false;
        text.horizontalOverflow = HorizontalWrapMode.Overflow;
        text.verticalOverflow = VerticalWrapMode.Overflow;
        return text;
    }

    private GameObject CreatePrimitive(string objectName, PrimitiveType type, Transform parent,
        Vector3 position, Vector3 scale, Material material, bool keepCollider,
        Quaternion? rotation = null)
    {
        GameObject instance = GameObject.CreatePrimitive(type);
        instance.name = objectName;
        instance.transform.SetParent(parent, false);
        instance.transform.localPosition = position;
        instance.transform.localScale = scale;
        if (rotation.HasValue)
            instance.transform.localRotation = rotation.Value;
        Renderer renderer = instance.GetComponent<Renderer>();
        renderer.sharedMaterial = material;
        if (!keepCollider)
        {
            Collider collider = instance.GetComponent<Collider>();
            if (collider != null)
                Destroy(collider);
        }
        return instance;
    }

    private static Transform NewChild(string name, Transform parent)
    {
        GameObject child = new GameObject(name);
        child.transform.SetParent(parent, false);
        return child.transform;
    }

    private static Mesh PrimitiveMesh(PrimitiveType type)
    {
        GameObject temporary = GameObject.CreatePrimitive(type);
        Mesh mesh = temporary.GetComponent<MeshFilter>().sharedMesh;
        Destroy(temporary);
        return mesh;
    }

    private Material Mat(string hex, float roughness)
    {
        if (materials.TryGetValue(hex, out Material cached))
            return cached;
        Color color;
        if (!ColorUtility.TryParseHtmlString(hex, out color))
            color = Color.white;
        Shader shader = Shader.Find("Standard");
        Material material = new Material(shader) { color = color, enableInstancing = true };
        material.SetFloat("_Glossiness", 1f - roughness);
        materials.Add(hex, material);
        return material;
    }

    private Vector2 RandomPoint(float extent)
    {
        return new Vector2(
            (float)(random.NextDouble() * extent * 2.0 - extent),
            (float)(random.NextDouble() * extent * 2.0 - extent));
    }

    private float Range(float min, float max)
    {
        return min + (float)random.NextDouble() * (max - min);
    }

    private bool NearTrail(Vector2 point, float margin)
    {
        if (Mathf.Abs(point.x) < margin && point.y > -66f && point.y < 66f)
            return true;
        float nw = DistanceToSegment(point, new Vector2(0f, 18f), new Vector2(-55f, 66f));
        float ne = DistanceToSegment(point, new Vector2(0f, 18f), new Vector2(55f, 66f));
        float west = DistanceToSegment(point, new Vector2(-4f, -4f), new Vector2(-66f, -30f));
        return Mathf.Min(nw, Mathf.Min(ne, west)) < margin;
    }

    private static float DistanceToSegment(Vector2 point, Vector2 start, Vector2 end)
    {
        Vector2 segment = end - start;
        float t = Mathf.Clamp01(Vector2.Dot(point - start, segment) / Mathf.Max(segment.sqrMagnitude, 0.001f));
        return Vector2.Distance(point, start + segment * t);
    }

    private static Sprite circleSprite;
    private static Sprite CircleSprite
    {
        get
        {
            if (circleSprite != null)
                return circleSprite;
            const int size = 96;
            Texture2D texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.name = "Runtime soft circle";
            texture.filterMode = FilterMode.Bilinear;
            Color[] pixels = new Color[size * size];
            Vector2 center = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
            float radius = size * 0.48f;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float distance = Vector2.Distance(new Vector2(x, y), center);
                float alpha = Mathf.Clamp01((radius - distance) / 1.7f);
                pixels[y * size + x] = new Color(1f, 1f, 1f, alpha);
            }
            texture.SetPixels(pixels);
            texture.Apply();
            circleSprite = Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
            return circleSprite;
        }
    }
}
