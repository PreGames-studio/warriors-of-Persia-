using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>
    /// Builds a walkable medieval forge from real meshes, local PBR materials, lights,
    /// colliders and particles. Architecture and props remain separate editable objects.
    /// </summary>
    public sealed class MedievalBlacksmithBuilder : MonoBehaviour
    {
        public BlacksmithDoor Door { get; private set; }
        public bool Built { get; private set; }

        private BlacksmithMaterialLibrary materials;
        private Transform staticRoot;
        private Transform dynamicRoot;
        private Transform effectsRoot;
        private Mesh bevel;
        private Mesh softBevel;
        private Mesh gable;
        private Mesh shield;
        private Mesh blade;
        private Mesh cylinder;
        private Mesh cone;
        private Mesh torus;
        private System.Random random;
        private readonly List<Light> flickeringLights = new List<Light>();
        private readonly List<Transform> animatedFlames = new List<Transform>();

        public void Build(Vector3? localPosition = null, float yaw = 180f)
        {
            if (Built) return;
            Door = GetComponentInChildren<BlacksmithDoor>();
            if (Door != null)
            {
                // The district was generated and saved from the editor earlier.
                Built = true;
                return;
            }
            Built = true;
            random = new System.Random(61803);
            if (localPosition.HasValue) transform.localPosition = localPosition.Value;
            transform.localRotation = Quaternion.Euler(0f, yaw, 0f);
            materials = new BlacksmithMaterialLibrary();
            bevel = BlacksmithMeshUtility.CreateBeveledBox(.055f);
            softBevel = BlacksmithMeshUtility.CreateBeveledBox(.1f);
            gable = BlacksmithMeshUtility.CreateGablePrism();
            shield = BlacksmithMeshUtility.CreateShield();
            blade = BlacksmithMeshUtility.CreateBlade();
            cylinder = BlacksmithMeshUtility.CreateCylinder(12);
            cone = BlacksmithMeshUtility.CreateCylinder(12, 0f);
            torus = BlacksmithMeshUtility.CreateTorus();
            staticRoot = Group("01 • STATIC • editable architecture and props", transform);
            dynamicRoot = Group("02 • DYNAMIC • door and fire", transform);
            effectsRoot = Group("03 • FX • smoke and sparks", transform);

            BuildArchitecture();
            BuildRoof();
            BuildDoor();
            BuildSign();
            BuildWindowsAndLanterns();
            BuildChimney();
            BuildWeaponDisplays();
            BuildAwningAndArmor();
            BuildInterior();
            BuildStreet();
            BuildNeighbors();
            BuildAtmosphere();

            // Dynamic door, particles and flames deliberately live outside this root.
            if (Application.isPlaying) StaticBatchingUtility.Combine(staticRoot.gameObject);
        }

        private void BuildArchitecture()
        {
            Transform root = Group("Architecture • stone shell and oak frame", staticRoot);
            Box("Interior flagstone floor", root, new Vector3(0f, .015f, 0f), new Vector3(9.55f, .16f, 7.65f), materials.StoneWall, null, true);

            // Two irregular courses of individual foundation blocks; the doorway stays clear.
            for (int row = 0; row < 2; row++)
            {
                float y = .29f + row * .47f;
                for (int i = 0; i < 10; i++)
                {
                    float x = -4.5f + i;
                    for (int side = -1; side <= 1; side += 2)
                    {
                        if (side > 0 && Mathf.Abs(x) < 1.65f) continue;
                        Box("Hand-cut foundation stone", root, new Vector3(x, y, side * 3.94f),
                            new Vector3(.94f, .43f, .54f), materials.StoneBlock,
                            Quaternion.Euler(Range(-1.2f, 1.2f), Range(-1.5f, 1.5f), Range(-1f, 1f)));
                    }
                }
                for (int i = 0; i < 8; i++)
                for (int side = -1; side <= 1; side += 2)
                {
                    Box("Side foundation stone", root, new Vector3(side * 4.78f, y, -3.45f + i * .98f),
                        new Vector3(.53f, .43f, .91f), materials.StoneBlock,
                        Quaternion.Euler(Range(-1f, 1f), Range(-1.2f, 1.2f), Range(-1.2f, 1.2f)));
                }
            }

            Box("West load-bearing stone wall", root, new Vector3(-4.75f, 2.66f, 0f), new Vector3(.46f, 3.86f, 7.7f), materials.StoneWall, null, true);
            Box("East load-bearing stone wall", root, new Vector3(4.75f, 2.66f, 0f), new Vector3(.46f, 3.86f, 7.7f), materials.StoneWall, null, true);
            Box("Rear stone wall", root, new Vector3(0f, 2.66f, -3.85f), new Vector3(9.55f, 3.86f, .46f), materials.StoneWall, null, true);
            Box("Front wall left of open doorway", root, new Vector3(-3.18f, 2.66f, 3.85f), new Vector3(3.2f, 3.86f, .46f), materials.StoneWall, null, true);
            Box("Front wall right of open doorway", root, new Vector3(3.18f, 2.66f, 3.85f), new Vector3(3.2f, 3.86f, .46f), materials.StoneWall, null, true);
            Box("Stone lintel above real doorway", root, new Vector3(0f, 4.18f, 3.85f), new Vector3(3.2f, .82f, .46f), materials.StoneWall, null, true);
            MeshObject("Front stone gable", root, gable, materials.StoneWall, new Vector3(0f, 5.84f, 3.86f), new Vector3(9.55f, 2.82f, .42f));
            MeshObject("Rear stone gable", root, gable, materials.StoneWall, new Vector3(0f, 5.84f, -3.86f), new Vector3(9.55f, 2.82f, .42f));

            for (int x = -1; x <= 1; x += 2)
            for (int z = -1; z <= 1; z += 2)
            {
                Box("Ancient corner oak post", root, new Vector3(x * 4.56f, 2.55f, z * 3.98f), new Vector3(.32f, 4.65f, .34f), materials.WoodDark, null, true);
                for (int band = 0; band < 3; band++)
                {
                    Box("Forged corner-post strap", root, new Vector3(x * 4.56f, 1.05f + band * 1.45f, z * 3.98f), new Vector3(.37f, .13f, .39f), materials.Iron);
                }
            }
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Massive entrance jamb", root, new Vector3(side * 1.52f, 1.92f, 4.09f), new Vector3(.31f, 3.85f, .38f), materials.WoodDark, null, true);
                Box("Entrance jamb iron foot", root, new Vector3(side * 1.52f, .36f, 4.1f), new Vector3(.38f, .68f, .43f), materials.Iron);
                Box("Front upright", root, new Vector3(side * 3.12f, 2.57f, 4.08f), new Vector3(.24f, 4.35f, .28f), materials.Wood);
                BeamBetween("Front diagonal compression brace", root, new Vector3(side * 4.38f, 1.03f, 4.11f), new Vector3(side * 2.02f, 3.63f, 4.11f), .22f, materials.WoodDark);
                BeamBetween("Gable rafter fascia", root, new Vector3(side * 4.55f, 4.5f, 4.1f), new Vector3(0f, 7.33f, 4.1f), .27f, materials.WoodDark);
                BeamBetween("Rear gable rafter fascia", root, new Vector3(side * 4.55f, 4.5f, -4.1f), new Vector3(0f, 7.33f, -4.1f), .25f, materials.WoodDark);
                BeamBetween("Side diagonal wind brace", root, new Vector3(side * 4.58f, 1.1f, -3.45f), new Vector3(side * 4.58f, 3.65f, -.65f), .2f, materials.WoodDark);
                Box("Side wall plate", root, new Vector3(side * 4.56f, 4.48f, 0f), new Vector3(.34f, .28f, 8.35f), materials.WoodDark);
                Box("Side lower rail", root, new Vector3(side * 4.56f, 1.02f, 0f), new Vector3(.29f, .22f, 8.05f), materials.Wood);
            }
            Box("Entrance crown beam", root, new Vector3(0f, 3.86f, 4.1f), new Vector3(3.45f, .34f, .43f), materials.WoodDark);
            Box("Front gable tie beam", root, new Vector3(0f, 4.52f, 4.09f), new Vector3(9.65f, .31f, .35f), materials.WoodDark);
            Box("Rear gable tie beam", root, new Vector3(0f, 4.52f, -4.09f), new Vector3(9.65f, .31f, .35f), materials.WoodDark);
            BeamBetween("Gable king post", root, new Vector3(0f, 4.52f, 4.12f), new Vector3(0f, 7.28f, 4.12f), .24f, materials.WoodDark);
            Box("Worn stone threshold", root, new Vector3(0f, .09f, 4.06f), new Vector3(2.85f, .18f, .75f), materials.StoneBlock, null, true);

            for (int i = 0; i < 9; i++)
            {
                float x = -4.2f + i * 1.05f;
                Rivet(root, new Vector3(x, 4.53f, 4.31f));
                if (i % 2 == 0) Rivet(root, new Vector3(x, 3.86f, 4.33f));
            }
        }

        private void BuildRoof()
        {
            Transform root = Group("Roof • individual weathered slate and exposed rafters", staticRoot);
            const float slope = 29f;
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Thick pitched roof substrate", root, new Vector3(side * 2.73f, 6.03f, 0f), new Vector3(6.35f, .24f, 9.25f), materials.Roof,
                    Quaternion.Euler(0f, 0f, -side * slope));
                Box("Deep eave timber", root, new Vector3(side * 5.22f, 4.51f, 0f), new Vector3(.28f, .3f, 9.45f), materials.WoodDark);
                for (int row = 0; row < 8; row++)
                {
                    float t = (row + .45f) / 8f;
                    for (int col = 0; col < 9; col++)
                    {
                        float x = side * (.15f + t * 5.25f);
                        float y = 7.63f - t * 3.02f + row * .006f;
                        float z = -4.35f + col * 1.085f + (row % 2) * .07f;
                        Box("Overlapping chipped slate tile", root, new Vector3(x, y, z),
                            new Vector3(.87f, .105f, 1.02f), materials.RoofTile,
                            Quaternion.Euler(Range(-.6f, .6f), Range(-.8f, .8f), -side * slope + Range(-.7f, .7f)));
                    }
                }
                for (int i = 0; i < 7; i++)
                {
                    float z = -4.2f + i * 1.4f;
                    BeamBetween("Exposed roof rafter", root, new Vector3(side * .12f, 7.35f, z), new Vector3(side * 5.32f, 4.39f, z), .18f, materials.WoodDark);
                }
            }
            for (int i = 0; i < 10; i++)
            {
                Cylinder("Slate ridge cap", root, new Vector3(0f, 7.72f, -4.45f + i * .99f), new Vector3(.43f, 1.06f, .43f), materials.RoofTile,
                    Quaternion.Euler(90f, 0f, 0f));
            }
        }

        private void BuildDoor()
        {
            Transform pivot = Group("DoorPivot • independent animated oak door", dynamicRoot);
            pivot.localPosition = new Vector3(-1.4f, 0f, 4.13f);
            Door = pivot.gameObject.AddComponent<BlacksmithDoor>();
            for (int i = 0; i < 6; i++)
            {
                Box("Solid vertical door plank", pivot, new Vector3((i + .5f) * (2.8f / 6f), 1.75f, 0f),
                    new Vector3(.45f, 3.48f - (i % 2) * .045f, .19f), i % 2 == 0 ? materials.Wood : materials.WoodDark);
            }
            for (int i = 0; i < 3; i++)
            {
                float y = .55f + i * 1.14f;
                Box("Hand-forged door strap", pivot, new Vector3(1.4f, y, .125f), new Vector3(2.69f, .15f, .075f), materials.Iron);
                for (int j = 0; j < 3; j++) Rivet(pivot, new Vector3(.18f + j * 1.21f, y, .19f));
                Cylinder("Heavy door hinge barrel", pivot, new Vector3(.02f, y, .03f), new Vector3(.19f, .48f, .19f), materials.Iron);
            }
            Box("Door handle backplate", pivot, new Vector3(2.31f, 1.64f, .15f), new Vector3(.25f, .4f, .09f), materials.Iron);
            Torus("Forged pull ring", pivot, new Vector3(2.31f, 1.58f, .27f), new Vector3(.17f, .17f, .17f), materials.Steel);
            BoxCollider collider = pivot.gameObject.AddComponent<BoxCollider>();
            collider.center = new Vector3(1.4f, 1.75f, 0f);
            collider.size = new Vector3(2.82f, 3.5f, .25f);
            Door.Configure();
        }

        private void BuildSign()
        {
            Transform root = Group("Hanging sign • hammer and anvil heraldry", staticRoot);
            Box("Sign support timber", root, new Vector3(0f, 6.35f, 4.48f), new Vector3(4.1f, .24f, .28f), materials.WoodDark);
            for (int side = -1; side <= 1; side += 2)
            {
                for (int link = 0; link < 4; link++)
                {
                    Torus("Individual hanging chain link", root, new Vector3(side * 1.02f, 6.22f - link * .18f, 4.61f),
                        new Vector3(.085f, .11f, .085f), materials.Iron,
                        Quaternion.Euler(0f, link % 2 == 0 ? 0f : 90f, 0f));
                }
            }
            Box("Carved sign board", root, new Vector3(0f, 5.12f, 4.63f), new Vector3(2.95f, 1.58f, .22f), materials.WoodDark);
            Box("Sign top metal border", root, new Vector3(0f, 5.89f, 4.78f), new Vector3(3.02f, .1f, .08f), materials.Gold);
            Box("Sign bottom metal border", root, new Vector3(0f, 4.35f, 4.78f), new Vector3(3.02f, .1f, .08f), materials.Gold);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Sign side metal border", root, new Vector3(side * 1.45f, 5.12f, 4.78f), new Vector3(.09f, 1.52f, .08f), materials.Gold);
                for (int y = 0; y < 3; y++) Rivet(root, new Vector3(side * 1.42f, 4.55f + y * .56f, 4.85f));
                Box("Crossed hammer handle", root, new Vector3(0f, 5.27f, 4.81f), new Vector3(.1f, 1.22f, .08f), materials.WoodLight,
                    Quaternion.Euler(0f, 0f, side * 43f));
                Box("Crossed hammer head", root, new Vector3(-side * .4f, 5.74f, 4.85f), new Vector3(.56f, .22f, .13f), materials.Steel,
                    Quaternion.Euler(0f, 0f, side * 43f));
            }
            Box("Anvil emblem top", root, new Vector3(0f, 5.06f, 4.96f), new Vector3(1.12f, .18f, .12f), materials.Steel);
            Box("Anvil emblem waist", root, new Vector3(0f, 4.86f, 4.96f), new Vector3(.34f, .31f, .12f), materials.Steel);
            Box("Anvil emblem foot", root, new Vector3(0f, 4.67f, 4.96f), new Vector3(.78f, .13f, .12f), materials.Steel);
            Cone("Anvil emblem horn", root, new Vector3(.72f, 5.06f, 4.96f), new Vector3(.2f, .52f, .2f), materials.Steel,
                Quaternion.Euler(0f, 0f, -90f));
            GameObject lettering = new GameObject("Forge name lettering");
            lettering.transform.SetParent(root, false);
            lettering.transform.localPosition = new Vector3(0f, 4.46f, 4.88f);
            TextMesh text = lettering.AddComponent<TextMesh>();
            text.text = "KAVEH'S FORGE";
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.fontSize = 42;
            text.characterSize = .038f;
            text.color = new Color(.92f, .72f, .34f);
        }

        private void BuildWindowsAndLanterns()
        {
            Transform root = Group("Windows and warm exterior lanterns", staticRoot);
            CreateWindow(root, new Vector3(-3.15f, 2.38f, 4.11f), 0f);
            CreateWindow(root, new Vector3(3.15f, 2.38f, 4.11f), 0f);
            CreateWindow(root, new Vector3(-4.99f, 2.5f, -.9f), -90f);
            CreateWindow(root, new Vector3(4.99f, 2.5f, -.9f), 90f);
            CreateLantern(root, new Vector3(-1.98f, 3.15f, 4.55f), true);
            CreateLantern(root, new Vector3(1.98f, 3.15f, 4.55f), true);
        }

        private void BuildChimney()
        {
            Transform root = Group("Chimney • individual masonry and smoke outlet", staticRoot);
            Box("Chimney dark core", root, new Vector3(-3f, 7.15f, -1.8f), new Vector3(1.22f, 4.9f, 1.22f), materials.StoneDark);
            for (int course = 0; course < 11; course++)
            {
                float y = 4.95f + course * .43f;
                float offset = course % 2 == 0 ? .08f : -.08f;
                for (int side = -1; side <= 1; side += 2)
                {
                    Box("Chimney face ashlar", root, new Vector3(-3f + offset, y, -1.8f + side * .62f), new Vector3(1.18f, .39f, .24f), materials.StoneBlock);
                    Box("Chimney side ashlar", root, new Vector3(-3f + side * .62f, y, -1.8f - offset), new Vector3(.24f, .39f, 1.18f), materials.StoneBlock);
                }
            }
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Chimney crown slab", root, new Vector3(-3f + side * .64f, 9.73f, -1.8f), new Vector3(.28f, .28f, 1.55f), materials.StoneBlock);
                Box("Chimney crown slab", root, new Vector3(-3f, 9.73f, -1.8f + side * .64f), new Vector3(1.25f, .28f, .28f), materials.StoneBlock);
            }
            Box("Soot-black chimney opening", root, new Vector3(-3f, 9.81f, -1.8f), new Vector3(.86f, .12f, .86f), materials.Coal);
            CreateSmoke(new Vector3(-3f, 10.02f, -1.8f));
        }

        private void BuildWeaponDisplays()
        {
            Transform root = Group("Weapon display • swords shields and helmets", staticRoot);
            Transform rack = Group("Left entrance weapon rack", root);
            rack.localPosition = new Vector3(-3.55f, .12f, 4.75f);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Rack upright", rack, new Vector3(side * 1.15f, 1.18f, 0f), new Vector3(.17f, 2.35f, .2f), materials.WoodDark);
                Box("Rack foot", rack, new Vector3(side * 1.15f, .08f, .15f), new Vector3(.55f, .16f, .75f), materials.WoodDark);
            }
            for (int i = 0; i < 3; i++) Box("Rack display rail", rack, new Vector3(0f, .45f + i * .78f, 0f), new Vector3(2.5f, .14f, .18f), materials.Wood);
            CreateSword(rack, new Vector3(-.82f, .45f, .19f), Quaternion.Euler(0f, 0f, -6f), .9f);
            CreateSword(rack, new Vector3(-.28f, .43f, .2f), Quaternion.Euler(0f, 0f, 4f), 1.02f);
            CreateSword(rack, new Vector3(.25f, .46f, .2f), Quaternion.Euler(0f, 0f, -3f), .84f);
            CreateShield(rack, new Vector3(.86f, 1.08f, .27f), Quaternion.Euler(0f, -8f, 0f), .9f);
            CreateCrate(root, new Vector3(-5.25f, 0f, 5.15f), .85f);
            CreateBarrel(root, new Vector3(-5.85f, 0f, 3.85f), .9f);
        }

        private void BuildAwningAndArmor()
        {
            Transform root = Group("Side forge awning • armor and outdoor anvil", staticRoot);
            for (int z = -1; z <= 1; z += 2)
            {
                Box("Awning outer post", root, new Vector3(6.85f, 1.72f, .6f + z * 2.25f), new Vector3(.22f, 3.44f, .22f), materials.WoodDark, null, true);
                BeamBetween("Awning knee brace", root, new Vector3(6.85f, 2.5f, .6f + z * 2.25f), new Vector3(5.6f, 3.55f, .6f + z * 2.25f), .16f, materials.Wood);
            }
            Box("Lean-to slate awning", root, new Vector3(5.82f, 3.65f, .6f), new Vector3(3.05f, .18f, 5.35f), materials.Roof,
                Quaternion.Euler(0f, 0f, -12f));
            Box("Awning front beam", root, new Vector3(5.82f, 3.43f, 3.25f), new Vector3(3.15f, .22f, .22f), materials.WoodDark);

            Transform armor = Group("Articulated armor display stand", root);
            armor.localPosition = new Vector3(5.95f, .1f, .75f);
            Box("Armor stand pole", armor, new Vector3(0f, 1.15f, 0f), new Vector3(.13f, 2.3f, .13f), materials.WoodDark);
            Box("Armor stand shoulders", armor, new Vector3(0f, 1.72f, 0f), new Vector3(1.3f, .12f, .12f), materials.Wood);
            Primitive("Steel cuirass", PrimitiveType.Sphere, armor, new Vector3(0f, 1.43f, 0f), new Vector3(.82f, 1.02f, .53f), materials.Steel);
            for (int side = -1; side <= 1; side += 2)
            {
                Primitive("Pauldron", PrimitiveType.Sphere, armor, new Vector3(side * .47f, 1.72f, 0f), new Vector3(.38f, .3f, .42f), materials.Steel);
                Cylinder("Vambrace", armor, new Vector3(side * .5f, 1.22f, 0f), new Vector3(.2f, .72f, .2f), materials.Steel,
                    Quaternion.Euler(0f, 0f, side * 7f));
            }
            Primitive("Displayed helm", PrimitiveType.Sphere, armor, new Vector3(0f, 2.2f, 0f), new Vector3(.53f, .55f, .5f), materials.Steel);
            Box("Helm visor slit", armor, new Vector3(0f, 2.18f, .25f), new Vector3(.36f, .07f, .035f), materials.Coal);
            CreateShield(armor, new Vector3(.72f, .85f, .12f), Quaternion.Euler(0f, -12f, 0f), .82f);
            Cylinder("Display spear shaft", armor, new Vector3(-.72f, 1.45f, 0f), new Vector3(.07f, 2.9f, .07f), materials.WoodLight);
            Cone("Display spear head", armor, new Vector3(-.72f, 3.05f, 0f), new Vector3(.17f, .45f, .17f), materials.Steel);

            Cylinder("Outdoor anvil stump", root, new Vector3(5.6f, .45f, 4.45f), new Vector3(1.05f, .9f, 1.05f), materials.WoodDark);
            CreateAnvil(root, new Vector3(5.6f, .88f, 4.45f), 1.05f, true);
            CreateBarrel(root, new Vector3(6.65f, 0f, 3.6f), .85f);
        }

        private void BuildInterior()
        {
            Transform root = Group("Interior • walkable active workshop", staticRoot);
            Box("Forge hearth base", root, new Vector3(-3f, .66f, -2.65f), new Vector3(2.25f, 1.3f, 1.45f), materials.StoneDark, null, true);
            Box("Forge chimney breast", root, new Vector3(-3f, 2.88f, -3.15f), new Vector3(2.05f, 3.35f, .95f), materials.StoneWall);
            Box("Sooted firebox mouth", root, new Vector3(-3f, .86f, -1.9f), new Vector3(1.45f, .86f, .12f), materials.Coal);
            for (int i = 0; i < 9; i++)
            {
                Primitive("Glowing coal in hearth", PrimitiveType.Sphere, root,
                    new Vector3(-3.52f + (i % 3) * .5f, .47f + (i / 3) * .07f, -1.8f + (i % 2) * .12f),
                    new Vector3(.38f, .18f, .28f), materials.Ember);
            }
            for (int i = 0; i < 6; i++)
            {
                GameObject flame = Cone("Living forge flame", dynamicRoot,
                    new Vector3(-3.45f + (i % 3) * .43f, .85f + (i % 2) * .12f, -1.72f + (i / 3) * .08f),
                    new Vector3(.28f, .85f + (i % 3) * .16f, .28f), materials.Ember,
                    Quaternion.Euler(Range(-9f, 9f), 0f, Range(-8f, 8f)));
                animatedFlames.Add(flame.transform);
            }
            PointLight(root, "Real forge illumination", new Vector3(-3f, 1.5f, -1.3f), new Color(1f, .29f, .055f), 3.1f, 11f, true);

            Cylinder("Interior anvil stump", root, new Vector3(.25f, .42f, -1.35f), new Vector3(1.0f, .84f, 1.0f), materials.WoodDark);
            CreateAnvil(root, new Vector3(.25f, .82f, -1.35f), 1.12f, true);
            Box("Heavy workbench top", root, new Vector3(2.95f, 1.02f, -2.75f), new Vector3(2.75f, .22f, 1.15f), materials.Wood, null, true);
            for (int x = -1; x <= 1; x += 2)
            for (int z = -1; z <= 1; z += 2)
            {
                Box("Workbench leg", root, new Vector3(2.95f + x * 1.08f, .5f, -2.75f + z * .39f), new Vector3(.2f, 1f, .2f), materials.WoodDark);
            }
            CreateSword(root, new Vector3(2.45f, 1.16f, -2.65f), Quaternion.Euler(78f, 12f, 88f), .72f);
            Box("Smith hammer handle on bench", root, new Vector3(3.25f, 1.19f, -2.55f), new Vector3(.08f, .72f, .08f), materials.WoodLight,
                Quaternion.Euler(75f, 0f, 62f));
            Box("Smith hammer head on bench", root, new Vector3(3.51f, 1.22f, -2.72f), new Vector3(.48f, .21f, .22f), materials.Iron,
                Quaternion.Euler(0f, 18f, 0f));
            Box("Interior tool rack", root, new Vector3(1.45f, 2.3f, -3.55f), new Vector3(3.25f, .18f, .16f), materials.WoodDark);
            for (int i = 0; i < 6; i++)
            {
                float x = .25f + i * .47f;
                Cylinder("Hanging tool handle", root, new Vector3(x, 1.83f, -3.45f), new Vector3(.065f, .75f, .065f), materials.WoodLight,
                    Quaternion.Euler(0f, 0f, Range(-8f, 8f)));
                Box("Hanging forged tool head", root, new Vector3(x, 1.47f, -3.44f), new Vector3(.28f, .15f, .12f), materials.Iron);
            }
            CreateBarrel(root, new Vector3(3.85f, .12f, 2.3f), .82f);
            CreateCrate(root, new Vector3(-3.85f, .12f, 2.1f), .75f);
            CreateSparks(new Vector3(-3f, .85f, -1.5f));
        }

        private void BuildStreet()
        {
            Transform root = Group("Street • cobbles mud moss barrels and coal", staticRoot);
            Box("Cobbled medieval street", root, new Vector3(2.5f, -.055f, 5f), new Vector3(25f, .14f, 20f), materials.Cobble);
            for (int i = 0; i < 74; i++)
            {
                float x = Range(-7.5f, 10.5f);
                float z = Range(4.4f, 11.8f);
                if (Mathf.Abs(x) < 1.5f && z < 5.5f) continue;
                Box("Raised uneven cobble", root, new Vector3(x, .035f, z),
                    new Vector3(Range(.35f, .8f), Range(.035f, .075f), Range(.28f, .65f)), materials.CobbleBlock,
                    Quaternion.Euler(0f, Range(-16f, 16f), 0f));
            }
            for (int i = 0; i < 18; i++)
            {
                Primitive("Moss in paving joints", PrimitiveType.Sphere, root, new Vector3(Range(-6.5f, 9f), .045f, Range(4.2f, 9.5f)),
                    new Vector3(Range(.12f, .34f), .025f, Range(.15f, .4f)), materials.Moss);
            }
            for (int i = 0; i < 3; i++)
            {
                Cylinder("Rain puddle reflecting the forge", root, new Vector3(-3.5f + i * 4.2f, .018f, 7.2f + (i % 2) * 1.3f),
                    new Vector3(1.35f + i * .22f, .018f, .85f + i * .12f), materials.Water);
            }
            CreateCrate(root, new Vector3(7.9f, 0f, 5.4f), 1f);
            CreateCrate(root, new Vector3(8.65f, 0f, 6.35f), .72f);
            CreateBarrel(root, new Vector3(-6.7f, 0f, 5.75f), 1f);
            CreateBarrel(root, new Vector3(-7.45f, 0f, 6.75f), .75f);
            for (int i = 0; i < 14; i++)
            {
                Primitive("Heap of forge coal", PrimitiveType.Sphere, root,
                    new Vector3(6.9f + Range(-.75f, .75f), .12f + (i % 3) * .08f, 2.95f + Range(-.55f, .55f)),
                    new Vector3(Range(.2f, .48f), Range(.15f, .32f), Range(.2f, .44f)), materials.Coal,
                    Quaternion.Euler(Range(0f, 90f), Range(0f, 90f), Range(0f, 90f)));
            }
            for (int i = 0; i < 7; i++)
            {
                Box("Stacked iron ingot", root, new Vector3(7.7f + (i % 2) * .42f, .12f + (i / 2) * .16f, 1.9f),
                    new Vector3(.38f, .14f, 1.05f), materials.Iron, Quaternion.Euler(0f, (i % 2) * 7f, 0f));
            }
        }

        private void BuildNeighbors()
        {
            Transform root = Group("Expandable medieval street • neighboring buildings", staticRoot);
            CreateNeighbor(root, new Vector3(-10f, 0f, -2.5f), new Vector3(5.7f, 4.1f, 5.8f), false);
            CreateNeighbor(root, new Vector3(18f, 0f, -3.5f), new Vector3(6.1f, 4.6f, 6.4f), true);
            CreateLantern(root, new Vector3(-6.3f, 2.65f, 1.1f), false);
            CreateLantern(root, new Vector3(8.2f, 2.8f, -.2f), false);
        }

        private void BuildAtmosphere()
        {
            BlacksmithAtmosphere atmosphere = gameObject.AddComponent<BlacksmithAtmosphere>();
            atmosphere.Configure(flickeringLights.ToArray());
            atmosphere.ConfigureFlames(animatedFlames.ToArray());
        }

        private void CreateWindow(Transform parent, Vector3 position, float yaw)
        {
            Transform root = Group("Recessed glowing window", parent);
            root.localPosition = position;
            root.localRotation = Quaternion.Euler(0f, yaw, 0f);
            Box("Window warm glass", root, Vector3.zero, new Vector3(1.08f, 1.36f, .09f), materials.Window);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Window side frame", root, new Vector3(side * .61f, 0f, .09f), new Vector3(.15f, 1.62f, .16f), materials.WoodDark);
                Box("Open weathered shutter", root, new Vector3(side * .99f, 0f, -.02f), new Vector3(.58f, 1.5f, .11f), materials.Wood,
                    Quaternion.Euler(0f, side * 19f, 0f));
            }
            for (int side = -1; side <= 1; side += 2)
                Box("Window horizontal frame", root, new Vector3(0f, side * .75f, .09f), new Vector3(1.38f, .15f, .16f), materials.WoodDark);
            Box("Window vertical mullion", root, new Vector3(0f, 0f, .14f), new Vector3(.065f, 1.4f, .07f), materials.Iron);
            Box("Window horizontal mullion", root, new Vector3(0f, 0f, .14f), new Vector3(1.12f, .065f, .07f), materials.Iron);
        }

        private void CreateLantern(Transform parent, Vector3 position, bool realLight)
        {
            Transform root = Group("Forged lantern", parent);
            root.localPosition = position;
            Box("Lantern wall mount", root, new Vector3(0f, .45f, -.2f), new Vector3(.1f, .8f, .1f), materials.Iron);
            BeamBetween("Lantern bracket", root, new Vector3(0f, .78f, -.2f), new Vector3(0f, .78f, .34f), .07f, materials.Iron);
            Box("Lantern glowing glass", root, new Vector3(0f, .1f, .35f), new Vector3(.34f, .57f, .34f), materials.Window);
            Box("Lantern base", root, new Vector3(0f, -.22f, .35f), new Vector3(.48f, .1f, .48f), materials.Iron);
            Cone("Lantern cap", root, new Vector3(0f, .54f, .35f), new Vector3(.57f, .28f, .57f), materials.Iron);
            for (int x = -1; x <= 1; x += 2)
            for (int z = -1; z <= 1; z += 2)
                Box("Lantern metal corner", root, new Vector3(x * .19f, .1f, .35f + z * .19f), new Vector3(.045f, .68f, .045f), materials.Iron);
            if (realLight)
            {
                PointLight(root, "Warm lantern light", new Vector3(0f, .12f, .62f), new Color(1f, .48f, .14f), 1.35f, 6.5f, true);
            }
        }

        private void CreateNeighbor(Transform parent, Vector3 position, Vector3 size, bool timberVariant)
        {
            Transform root = Group(timberVariant ? "Future armorer building" : "Future inn building", parent);
            root.localPosition = position;
            Box("Neighbor stone walls", root, new Vector3(0f, size.y * .5f, 0f), size, timberVariant ? materials.StoneDark : materials.StoneWall, null, true);
            MeshObject("Neighbor front gable", root, gable, materials.StoneDark, new Vector3(0f, size.y + 1.15f, size.z * .5f), new Vector3(size.x, 2.3f, .3f));
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Neighbor pitched roof", root, new Vector3(side * size.x * .27f, size.y + 1.15f, 0f),
                    new Vector3(size.x * .63f, .22f, size.z + .65f), materials.Roof,
                    Quaternion.Euler(0f, 0f, -side * 31f));
                Box("Neighbor corner timber", root, new Vector3(side * (size.x * .5f - .15f), size.y * .5f, size.z * .5f + .08f),
                    new Vector3(.24f, size.y, .24f), materials.WoodDark);
            }
            Box("Neighbor door", root, new Vector3(0f, 1.25f, size.z * .5f + .12f), new Vector3(1.35f, 2.5f, .16f), materials.WoodDark);
            CreateWindow(root, new Vector3(-size.x * .27f, 2.2f, size.z * .5f + .14f), 0f);
            CreateWindow(root, new Vector3(size.x * .27f, 2.2f, size.z * .5f + .14f), 0f);
        }

        private void CreateSword(Transform parent, Vector3 position, Quaternion rotation, float scale)
        {
            Transform root = Group("Forged sword", parent);
            root.localPosition = position;
            root.localRotation = rotation;
            root.localScale = Vector3.one * scale;
            Cylinder("Sword leather grip", root, new Vector3(0f, .2f, 0f), new Vector3(.11f, .4f, .11f), materials.WoodDark);
            Sphere("Sword pommel", root, new Vector3(0f, -.03f, 0f), new Vector3(.16f, .16f, .16f), materials.Gold);
            Box("Sword crossguard", root, new Vector3(0f, .46f, 0f), new Vector3(.58f, .09f, .13f), materials.Gold);
            MeshObject("Diamond-section sharpened blade", root, blade, materials.Steel, new Vector3(0f, .5f, 0f), Vector3.one);
        }

        private void CreateShield(Transform parent, Vector3 position, Quaternion rotation, float scale)
        {
            Transform root = Group("Heater shield with forged boss", parent);
            root.localPosition = position;
            root.localRotation = rotation;
            root.localScale = Vector3.one * scale;
            MeshObject("Shield steel body", root, shield, materials.Steel, Vector3.zero, Vector3.one);
            Box("Shield gilt vertical device", root, new Vector3(0f, .02f, .085f), new Vector3(.075f, .72f, .035f), materials.Gold);
            Box("Shield gilt cross device", root, new Vector3(0f, .2f, .085f), new Vector3(.55f, .07f, .035f), materials.Gold);
            Sphere("Shield central boss", root, new Vector3(0f, .06f, .13f), new Vector3(.22f, .22f, .13f), materials.Iron);
        }

        private void CreateAnvil(Transform parent, Vector3 position, float scale, bool solid)
        {
            Transform root = Group("Blacksmith anvil", parent);
            root.localPosition = position;
            root.localScale = Vector3.one * scale;
            Box("Anvil broad foot", root, new Vector3(0f, .1f, 0f), new Vector3(1.18f, .2f, .7f), materials.Iron);
            Box("Anvil foot stem", root, new Vector3(0f, .3f, 0f), new Vector3(.7f, .22f, .5f), materials.Iron);
            Box("Anvil forged waist", root, new Vector3(0f, .54f, 0f), new Vector3(.44f, .34f, .42f), materials.Iron);
            Box("Anvil hardened face", root, new Vector3(0f, .79f, 0f), new Vector3(1.35f, .23f, .64f), materials.Steel);
            Box("Anvil square heel", root, new Vector3(-.82f, .78f, 0f), new Vector3(.43f, .22f, .56f), materials.Iron);
            Cone("Anvil tapered horn", root, new Vector3(.91f, .8f, 0f), new Vector3(.34f, .78f, .34f), materials.Steel,
                Quaternion.Euler(0f, 0f, -90f));
            if (solid)
            {
                BoxCollider collider = root.gameObject.AddComponent<BoxCollider>();
                collider.center = new Vector3(0f, .47f, 0f);
                collider.size = new Vector3(1.75f, .95f, .78f);
            }
        }

        private void CreateBarrel(Transform parent, Vector3 position, float scale)
        {
            Transform root = Group("Coopered oak barrel", parent);
            root.localPosition = position;
            root.localScale = Vector3.one * scale;
            Cylinder("Barrel dark core", root, new Vector3(0f, .64f, 0f), new Vector3(1.0f, 1.28f, 1.0f), materials.WoodDark);
            for (int i = 0; i < 12; i++)
            {
                float angle = i * 360f / 12f;
                float radians = angle * Mathf.Deg2Rad;
                Box("Individual barrel stave", root, new Vector3(Mathf.Sin(radians) * .49f, .65f, Mathf.Cos(radians) * .49f),
                    new Vector3(.2f, 1.25f, .11f), materials.Wood, Quaternion.Euler(0f, angle, 0f));
            }
            for (int i = 0; i < 3; i++)
                Torus("Barrel forged hoop", root, new Vector3(0f, .18f + i * .46f, 0f), new Vector3(.52f, .52f, .52f), materials.Iron,
                    Quaternion.Euler(90f, 0f, 0f));
            BoxCollider collider = root.gameObject.AddComponent<BoxCollider>();
            collider.center = new Vector3(0f, .62f, 0f);
            collider.size = new Vector3(1.05f, 1.3f, 1.05f);
        }

        private void CreateCrate(Transform parent, Vector3 position, float scale)
        {
            Transform root = Group("Iron-bound supply crate", parent);
            root.localPosition = position;
            root.localRotation = Quaternion.Euler(0f, Range(-9f, 9f), 0f);
            root.localScale = Vector3.one * scale;
            Box("Crate body", root, new Vector3(0f, .45f, 0f), new Vector3(1f, .9f, 1f), materials.WoodDark);
            for (int side = -1; side <= 1; side += 2)
            {
                Box("Crate edge batten", root, new Vector3(side * .43f, .45f, .51f), new Vector3(.12f, .94f, .1f), materials.WoodLight);
                Box("Crate iron strap", root, new Vector3(side * .31f, .46f, .56f), new Vector3(.07f, .92f, .05f), materials.Iron);
                BeamBetween("Crate diagonal reinforcement", root, new Vector3(-.4f, side > 0 ? .08f : .82f, .55f), new Vector3(.4f, side > 0 ? .82f : .08f, .55f), .09f, materials.Wood);
            }
            BoxCollider collider = root.gameObject.AddComponent<BoxCollider>();
            collider.center = new Vector3(0f, .45f, 0f);
            collider.size = new Vector3(1.05f, .95f, 1.05f);
        }

        private void CreateSmoke(Vector3 position)
        {
            ParticleSystem ps = CreateParticleSystem("Soft chimney smoke", position, materials.Smoke, 7f, 3.8f, .65f, 1.15f, 22,
                new Color(.55f, .61f, .67f, .34f));
            ParticleSystem.ShapeModule shape = ps.shape;
            shape.angle = 11f;
            shape.radius = .17f;
            ParticleSystem.VelocityOverLifetimeModule velocity = ps.velocityOverLifetime;
            velocity.enabled = true;
            velocity.space = ParticleSystemSimulationSpace.World;
            velocity.x = new ParticleSystem.MinMaxCurve(.24f);
            velocity.y = new ParticleSystem.MinMaxCurve(.12f);
            velocity.z = new ParticleSystem.MinMaxCurve(.06f);
            ParticleSystem.SizeOverLifetimeModule size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0f, .55f), new Keyframe(1f, 1.65f)));
            SetFade(ps, new Color(.58f, .63f, .68f), .42f);
        }

        private void CreateSparks(Vector3 position)
        {
            ParticleSystem ps = CreateParticleSystem("Rising forge embers", position, materials.Spark, 10f, 1.35f, 1.35f, .065f, 24,
                new Color(1f, .36f, .035f, 1f));
            ParticleSystem.ShapeModule shape = ps.shape;
            shape.angle = 17f;
            shape.radius = .36f;
            ParticleSystem.VelocityOverLifetimeModule velocity = ps.velocityOverLifetime;
            velocity.enabled = true;
            velocity.space = ParticleSystemSimulationSpace.Local;
            velocity.x = new ParticleSystem.MinMaxCurve(-.18f, .18f);
            velocity.z = new ParticleSystem.MinMaxCurve(-.08f, .16f);
            SetFade(ps, new Color(1f, .42f, .045f), 1f);
        }

        private ParticleSystem CreateParticleSystem(string name, Vector3 position, Material material, float rate, float lifetime,
            float speed, float size, int maximum, Color startColor)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(effectsRoot, false);
            go.transform.localPosition = position;
            go.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f); // Cone +Z becomes world-up +Y.
            ParticleSystem ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            ParticleSystem.MainModule main = ps.main;
            main.loop = true;
            main.playOnAwake = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(lifetime * .75f, lifetime * 1.25f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(speed * .65f, speed * 1.15f);
            main.startSize = new ParticleSystem.MinMaxCurve(size * .7f, size * 1.3f);
            main.startColor = new ParticleSystem.MinMaxGradient(startColor);
            main.startRotation = new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2f);
            main.maxParticles = maximum;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            ParticleSystem.EmissionModule emission = ps.emission;
            emission.rateOverTime = rate;
            ParticleSystem.ShapeModule shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            ParticleSystemRenderer renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.sharedMaterial = material;
            ps.Play();
            return ps;
        }

        private static void SetFade(ParticleSystem ps, Color color, float alpha)
        {
            Gradient gradient = new Gradient();
            gradient.SetKeys(
                new[] { new GradientColorKey(color, 0f), new GradientColorKey(color, 1f) },
                new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(alpha, .16f), new GradientAlphaKey(alpha * .65f, .62f), new GradientAlphaKey(0f, 1f) });
            ParticleSystem.ColorOverLifetimeModule colorOverLifetime = ps.colorOverLifetime;
            colorOverLifetime.enabled = true;
            colorOverLifetime.color = new ParticleSystem.MinMaxGradient(gradient);
        }

        private Light PointLight(Transform parent, string name, Vector3 position, Color color, float intensity, float range, bool flicker)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            Light light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = color;
            light.intensity = intensity;
            light.range = range;
            light.shadows = LightShadows.None;
            light.renderMode = LightRenderMode.ForcePixel;
            if (flicker) flickeringLights.Add(light);
            return light;
        }

        private void Rivet(Transform parent, Vector3 position)
        {
            Cylinder("Hand-forged rivet", parent, position, new Vector3(.095f, .07f, .095f), materials.Iron,
                Quaternion.Euler(90f, 0f, 0f));
        }

        private Transform Group(string name, Transform parent)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go.transform;
        }

        private GameObject Box(string name, Transform parent, Vector3 position, Vector3 scale, Material material,
            Quaternion? rotation = null, bool solid = false)
        {
            return MeshObject(name, parent, bevel, material, position, scale, rotation ?? Quaternion.identity, solid);
        }

        private GameObject MeshObject(string name, Transform parent, Mesh mesh, Material material, Vector3 position,
            Vector3 scale, Quaternion? rotation = null, bool solid = false)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localRotation = rotation ?? Quaternion.identity;
            go.transform.localScale = scale;
            MeshFilter filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            MeshRenderer renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            if (solid) go.AddComponent<BoxCollider>();
            return go;
        }

        private GameObject Primitive(string name, PrimitiveType type, Transform parent, Vector3 position, Vector3 scale,
            Material material, Quaternion? rotation = null)
        {
            GameObject go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = position;
            go.transform.localRotation = rotation ?? Quaternion.identity;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = material;
            Collider collider = go.GetComponent<Collider>();
            if (collider != null)
            {
                if (Application.isPlaying) Destroy(collider);
                else DestroyImmediate(collider);
            }
            return go;
        }

        private GameObject Sphere(string name, Transform parent, Vector3 position, Vector3 scale, Material material)
        {
            return Primitive(name, PrimitiveType.Sphere, parent, position, scale, material);
        }

        private GameObject Cylinder(string name, Transform parent, Vector3 position, Vector3 scale, Material material,
            Quaternion? rotation = null)
        {
            return MeshObject(name, parent, cylinder, material, position, scale, rotation);
        }

        private GameObject Cone(string name, Transform parent, Vector3 position, Vector3 scale, Material material,
            Quaternion? rotation = null)
        {
            return MeshObject(name, parent, cone, material, position, scale, rotation);
        }

        private GameObject Torus(string name, Transform parent, Vector3 position, Vector3 scale, Material material,
            Quaternion? rotation = null)
        {
            return MeshObject(name, parent, torus, material, position, scale, rotation);
        }

        private void BeamBetween(string name, Transform parent, Vector3 start, Vector3 end, float thickness, Material material)
        {
            Vector3 delta = end - start;
            Box(name, parent, (start + end) * .5f, new Vector3(thickness, delta.magnitude, thickness), material,
                Quaternion.FromToRotation(Vector3.up, delta.normalized));
        }

        private float Range(float minimum, float maximum)
        {
            return minimum + (float)random.NextDouble() * (maximum - minimum);
        }
    }
}
