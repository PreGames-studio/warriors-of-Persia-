using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>
    /// Detailed, shared-mesh village architecture. The old world positions and
    /// footprints are retained; only the render geometry and surface treatment
    /// are upgraded. Houses are decorative colliders, so gameplay paths stay put.
    /// </summary>
    public static class MedievalVillageBuilder
    {
        private static Mesh bevel;
        private static Mesh gable;
        private static Mesh[] stones;
        private static System.Random random;

        public static void CreateGate(Transform parent, float z)
        {
            EnsureMeshes();
            BlacksmithMaterialLibrary materials = new BlacksmithMaterialLibrary();
            Transform root = Group("Detailed Persian village gate", parent);
            root.localPosition = new Vector3(0f, 0f, z);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Gate dressed stone pier", root, new Vector3(side * 3.4f, 2f, 0f), new Vector3(.9f, 4f, 1.05f), materials.StoneWall, null, true);
                for (int row = 0; row < 6; row++)
                {
                    Stone("Gate pier ashlar", root, new Vector3(side * 3.4f, .45f + row * .62f, .57f),
                        new Vector3(.92f, .5f, .18f), materials.StoneBlock);
                }
                Box("Gate timber post", root, new Vector3(side * 2.86f, 2.2f, .65f), new Vector3(.22f, 4.4f, .22f), materials.WoodDark);
            }
            Box("Gate massive timber lintel", root, new Vector3(0f, 4.12f, .1f), new Vector3(7.7f, .58f, 1.05f), materials.WoodDark);
            BeamBetween("Gate left knee brace", root, new Vector3(-3.1f, 3.1f, .72f), new Vector3(-1.5f, 4.05f, .72f), .2f, materials.Wood);
            BeamBetween("Gate right knee brace", root, new Vector3(3.1f, 3.1f, .72f), new Vector3(1.5f, 4.05f, .72f), .2f, materials.Wood);
            for (int side = -1; side <= 1; side += 2)
            {
                for (int i = 0; i < 5; i++)
                {
                    Box("Gate oak door plank", root, new Vector3(side * (1.45f + (i - 2) * .38f), 1.75f, .22f),
                        new Vector3(.36f, 3.45f, .18f), i % 2 == 0 ? materials.Wood : materials.WoodDark);
                }
                for (int row = 0; row < 3; row++)
                    Box("Gate forged door band", root, new Vector3(side * 1.45f, .7f + row * 1.05f, .36f),
                        new Vector3(2.15f, .1f, .07f), materials.Iron);
            }
            Box("Gate bronze crest", root, new Vector3(0f, 4.22f, .7f), new Vector3(.72f, .72f, .12f), materials.Gold);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Gate roof slab", root, new Vector3(side * 1.95f, 4.85f, 0f), new Vector3(4.2f, .2f, 2f), materials.Roof,
                    Quaternion.Euler(0f, 0f, -side * 23f));
                for (int i = 0; i < 6; i++)
                    Box("Gate roof slate", root, new Vector3(side * (i * .55f), 5.6f - i * .25f, 0f),
                        new Vector3(.62f, .1f, 2.05f), materials.RoofTile, Quaternion.Euler(0f, 0f, -side * 23f));
            }
        }

        public static void CreateHouse(Transform parent, Vector3 position, Vector3 size, bool timberVariant)
        {
            EnsureMeshes();
            random = new System.Random(timberVariant ? 9301 : 9307);
            BlacksmithMaterialLibrary materials = new BlacksmithMaterialLibrary();
            Transform root = Group(timberVariant ? "Detailed timber merchant house" : "Detailed stone merchant house", parent);
            root.localPosition = position;
            float width = size.x;
            float height = size.y;
            float depth = size.z;
            float front = depth * .5f;

            Box("House continuous collision shell", root, new Vector3(0f, height * .5f, 0f), size,
                timberVariant ? materials.StoneDark : materials.StoneWall, null, true);
            MeshObject("House front gable", root, gable, materials.StoneWall,
                new Vector3(0f, height + 1.12f, front), new Vector3(width, 2.24f, .3f));
            BuildHouseMasonry(root, width, height, depth, materials);
            BuildHouseFrame(root, width, height, depth, front, materials, timberVariant);
            BuildHouseRoof(root, width, height, depth, materials);
            BuildHouseDoorAndWindows(root, width, height, front, materials);
            Box("House stone chimney", root, new Vector3(-width * .25f, height + 1.3f, -depth * .2f),
                new Vector3(.72f, 2.5f, .72f), materials.StoneDark);
            for (int i = 0; i < 5; i++)
                Box("House chimney cap stone", root, new Vector3(-width * .25f, height + 2.55f, -depth * .2f + (i - 2) * .16f),
                    new Vector3(.84f, .18f, .14f), materials.StoneBlock);
            PolyhavenPropLibrary.Instantiate("Barrel_01", root, new Vector3(-width * .62f, 0f, front + .6f),
                Quaternion.Euler(0f, 12f, 0f), 1.05f);
            if (timberVariant)
                PolyhavenPropLibrary.Instantiate("wooden_crate_01", root, new Vector3(width * .58f, 0f, front + .55f),
                    Quaternion.Euler(0f, -15f, 0f), 1.2f);
        }

        private static void BuildHouseMasonry(Transform root, float width, float height, float depth, BlacksmithMaterialLibrary materials)
        {
            for (int side = -1; side <= 1; side += 2)
            for (int row = 0; row < 6; row++)
            for (int col = 0; col < 7; col++)
            {
                float x = side * (width * .5f + .08f);
                float z = -depth * .43f + col * depth * .143f;
                Stone("House side irregular stone", root, new Vector3(x, .55f + row * .58f, z),
                    new Vector3(.16f, .43f, depth * .12f), materials.StoneBlock,
                    Quaternion.Euler(Range(-1f, 1f), Range(-1.5f, 1.5f), Range(-1f, 1f)));
            }
            for (int row = 0; row < 6; row++)
            for (int col = 0; col < 8; col++)
            {
                float x = -width * .43f + col * width * .123f + (row % 2) * .1f;
                Stone("House front irregular stone", root, new Vector3(x, .55f + row * .58f, depth * .5f + .08f),
                    new Vector3(width * .105f, .43f, .16f), materials.StoneBlock,
                    Quaternion.Euler(Range(-1f, 1f), Range(-1.5f, 1.5f), Range(-1f, 1f)));
            }
        }

        private static void BuildHouseFrame(Transform root, float width, float height, float depth, float front,
            BlacksmithMaterialLibrary materials, bool timberVariant)
        {
            for (int side = -1; side <= 1; side += 2)
            {
                Box("House corner oak post", root, new Vector3(side * (width * .5f - .12f), height * .5f, front + .16f),
                    new Vector3(.24f, height, .25f), materials.WoodDark);
                BeamBetween("House diagonal timber brace", root,
                    new Vector3(side * (width * .42f), .8f, front + .18f),
                    new Vector3(side * (width * .16f), height - .4f, front + .18f), .17f, materials.WoodDark);
                Box("House roof plate", root, new Vector3(side * width * .47f, height, 0f),
                    new Vector3(.25f, .24f, depth + .25f), materials.Wood);
            }
            Box("House front tie beam", root, new Vector3(0f, height - .1f, front + .18f),
                new Vector3(width, .28f, .28f), materials.WoodDark);
            if (timberVariant)
            {
                Box("Merchant upper timber rail", root, new Vector3(0f, height * .57f, front + .18f),
                    new Vector3(width, .16f, .18f), materials.Wood);
            }
        }

        private static void BuildHouseRoof(Transform root, float width, float height, float depth, BlacksmithMaterialLibrary materials)
        {
            for (int side = -1; side <= 1; side += 2)
            {
                Box("House pitched roof substrate", root, new Vector3(side * width * .25f, height + 1.05f, 0f),
                    new Vector3(width * .62f, .2f, depth + .65f), materials.Roof,
                    Quaternion.Euler(0f, 0f, -side * 29f));
                for (int row = 0; row < 5; row++)
                for (int col = 0; col < 7; col++)
                {
                    float t = (row + .5f) / 5f;
                    Box("House overlapping slate tile", root,
                        new Vector3(side * (width * (.05f + t * .46f)), height + 2.45f - t * 2.25f,
                            -depth * .43f + col * depth * .143f),
                        new Vector3(width * .15f, .09f, depth * .14f), materials.RoofTile,
                        Quaternion.Euler(0f, Range(-.7f, .7f), -side * 29f + Range(-.6f, .6f)));
                }
            }
            Box("House ridge beam", root, new Vector3(0f, height + 2.52f, 0f), new Vector3(.25f, .25f, depth + .7f), materials.WoodDark);
        }

        private static void BuildHouseDoorAndWindows(Transform root, float width, float height, float front,
            BlacksmithMaterialLibrary materials)
        {
            for (int i = 0; i < 4; i++)
                Box("House door plank", root, new Vector3(-.63f + i * .42f, 1.15f, front + .18f),
                    new Vector3(.4f, 2.3f, .14f), i % 2 == 0 ? materials.Wood : materials.WoodDark);
            for (int i = 0; i < 2; i++)
                Box("House door iron strap", root, new Vector3(0f, .7f + i * .85f, front + .28f),
                    new Vector3(1.5f, .09f, .06f), materials.Iron);
            CreateWindow(root, new Vector3(-width * .28f, height * .57f, front + .18f), materials);
            CreateWindow(root, new Vector3(width * .28f, height * .57f, front + .18f), materials);
            Box("House entrance step", root, new Vector3(0f, .1f, front + .38f), new Vector3(1.9f, .2f, .65f), materials.StoneBlock);
        }

        private static void CreateWindow(Transform root, Vector3 position, BlacksmithMaterialLibrary materials)
        {
            Box("House warm recessed window", root, position, new Vector3(.85f, 1.05f, .08f), materials.Window);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("House window jamb", root, position + new Vector3(side * .5f, 0f, .08f), new Vector3(.12f, 1.25f, .14f), materials.WoodDark);
                Box("House open shutter", root, position + new Vector3(side * .73f, 0f, .02f), new Vector3(.36f, 1.1f, .1f), materials.Wood);
            }
            Box("House window crossbar", root, position + new Vector3(0f, 0f, .12f), new Vector3(.06f, 1.1f, .06f), materials.Iron);
            Box("House window sill", root, position + new Vector3(0f, -.6f, .12f), new Vector3(1.15f, .12f, .25f), materials.StoneBlock);
        }

        private static void EnsureMeshes()
        {
            if (bevel != null) return;
            bevel = BlacksmithMeshUtility.CreateBeveledBox(.07f);
            gable = BlacksmithMeshUtility.CreateGablePrism();
            stones = new[]
            {
                BlacksmithMeshUtility.CreateIrregularStone(131),
                BlacksmithMeshUtility.CreateIrregularStone(173),
                BlacksmithMeshUtility.CreateIrregularStone(197)
            };
        }

        private static Transform Group(string name, Transform parent)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go.transform;
        }

        private static GameObject Box(string name, Transform parent, Vector3 position, Vector3 scale,
            Material material, Quaternion? rotation = null, bool solid = false)
        {
            return MeshObject(name, parent, bevel, material, position, scale, rotation, solid);
        }

        private static GameObject Stone(string name, Transform parent, Vector3 position, Vector3 scale,
            Material material, Quaternion? rotation = null)
        {
            int index = Mathf.Abs(Mathf.RoundToInt(position.x * 11f + position.y * 17f + position.z * 23f)) % stones.Length;
            return MeshObject(name, parent, stones[index], material, position, scale, rotation, false);
        }

        private static GameObject MeshObject(string name, Transform parent, Mesh mesh, Material material,
            Vector3 position, Vector3 scale, Quaternion? rotation = null, bool solid = false)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localRotation = rotation ?? Quaternion.identity;
            go.transform.localScale = scale;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = material;
            if (solid) go.AddComponent<BoxCollider>();
            return go;
        }

        private static void BeamBetween(string name, Transform parent, Vector3 start, Vector3 end,
            float thickness, Material material)
        {
            Vector3 delta = end - start;
            Box(name, parent, (start + end) * .5f, new Vector3(thickness, delta.magnitude, thickness), material,
                Quaternion.FromToRotation(Vector3.up, delta.normalized));
        }

        private static float Range(float min, float max)
        {
            return min + (float)random.NextDouble() * (max - min);
        }
    }
}
