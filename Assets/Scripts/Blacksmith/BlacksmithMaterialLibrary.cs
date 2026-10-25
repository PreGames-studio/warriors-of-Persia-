using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>Built-in Standard PBR material definitions using original local textures.</summary>
    public sealed class BlacksmithMaterialLibrary
    {
        public const string ResourceRoot = "BlacksmithExterior";
        public static readonly string[] MaterialNames =
        {
            "Stone", "StoneWall", "StoneBlock", "StoneDark", "Wood", "WoodDark", "WoodLight",
            "Roof", "RoofTile", "Iron", "Steel", "Gold", "Cobble", "CobbleBlock", "Water",
            "Coal", "Moss", "Ember", "Window", "Smoke", "Spark",
            "Grass", "GrassDry", "GrassDark", "Earth"
        };

        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        public Material Stone => Get("Stone");
        public Material StoneWall => Get("StoneWall");
        public Material StoneBlock => Get("StoneBlock");
        public Material StoneDark => Get("StoneDark");
        public Material Wood => Get("Wood");
        public Material WoodDark => Get("WoodDark");
        public Material WoodLight => Get("WoodLight");
        public Material Roof => Get("Roof");
        public Material RoofTile => Get("RoofTile");
        public Material Iron => Get("Iron");
        public Material Steel => Get("Steel");
        public Material Gold => Get("Gold");
        public Material Cobble => Get("Cobble");
        public Material CobbleBlock => Get("CobbleBlock");
        public Material Water => Get("Water");
        public Material Coal => Get("Coal");
        public Material Moss => Get("Moss");
        public Material Ember => Get("Ember");
        public Material Window => Get("Window");
        public Material Smoke => Get("Smoke");
        public Material Spark => Get("Spark");

        public Material Get(string name)
        {
            if (materials.TryGetValue(name, out Material cached)) return cached;
            Material material = Resources.Load<Material>(ResourceRoot + "/Materials/" + name);
            if (material == null) material = CreateMaterial(name);
            materials.Add(name, material);
            return material;
        }

        public static Material CreateMaterial(string name)
        {
            switch (name)
            {
                case "Stone": return CreatePbr(name, "stone", Color.white, Vector2.one);
                case "StoneWall": return CreatePbr(name, "stone", new Color(.84f, .88f, .9f), new Vector2(2.2f, 1.15f));
                case "StoneBlock": return CreatePbr(name, "stone", new Color(.9f, .93f, .94f), new Vector2(.19f, .17f));
                case "StoneDark": return CreatePbr(name, "stone", new Color(.43f, .48f, .52f), new Vector2(1.4f, 1.4f));
                case "Wood": return CreatePbr(name, "wood", new Color(.92f, .82f, .72f), new Vector2(1f, 1.8f));
                case "WoodDark": return CreatePbr(name, "wood", new Color(.54f, .48f, .43f), new Vector2(1f, 2.2f));
                case "WoodLight": return CreatePbr(name, "wood", new Color(1.18f, 1.08f, .91f), new Vector2(1.3f, 1f));
                case "Roof": return CreatePbr(name, "roof", new Color(.78f, .86f, .94f), new Vector2(1.7f, 2.1f));
                case "RoofTile": return CreatePbr(name, "roof", new Color(.86f, .92f, .98f), new Vector2(.21f, .14f));
                case "Iron": return CreatePbr(name, "metal", new Color(.68f, .72f, .75f), Vector2.one);
                case "Cobble": return CreatePbr(name, "cobble", new Color(.88f, .9f, .88f), new Vector2(3.5f, 3.5f));
                case "CobbleBlock": return CreatePbr(name, "cobble", new Color(.82f, .85f, .84f), new Vector2(.17f, .14f));
                case "Water": return CreateWater(name);
                case "Steel": return CreateSolidMetal(name, new Color(.52f, .59f, .62f), .9f, .57f);
                case "Gold": return CreateSolidMetal(name, new Color(.78f, .48f, .14f), .86f, .48f);
                case "Coal": return CreateSolid(name, new Color(.018f, .022f, .026f), .12f, .24f, true);
                case "Moss": return CreateSolid(name, new Color(.07f, .12f, .055f), 0f, .93f, true);
                case "Ember": return CreateEmission(name, new Color(.24f, .025f, .003f), new Color(1f, .19f, .012f) * 3.2f);
                case "Window": return CreateEmission(name, new Color(.34f, .095f, .016f), new Color(1f, .32f, .055f) * 2.2f);
                case "Smoke": return CreateParticle(name, "smoke", false);
                case "Spark": return CreateParticle(name, "spark", true);
                case "Grass": return CreatePbr(name, "grass", Color.white, new Vector2(18f, 18f));
                case "GrassDry": return CreatePbr(name, "grass_dry", new Color(.9f, .94f, .86f), new Vector2(12f, 12f));
                case "GrassDark": return CreatePbr(name, "grass_dark", new Color(.86f, .92f, .88f), new Vector2(10f, 10f));
                case "Earth": return CreatePbr(name, "earth", Color.white, new Vector2(4f, 14f));
                default: return CreateSolid(name, Color.magenta, 0f, .5f, false);
            }
        }

        private static Material CreatePbr(string name, string textureSet, Color tint, Vector2 tiling)
        {
            Material material = Standard(name, tint);
            Texture2D albedo = Texture(textureSet + "_albedo");
            Texture2D normal = Texture(textureSet + "_normal");
            Texture2D metallic = Texture(textureSet + "_metallic_smoothness");
            Texture2D ao = Texture(textureSet + "_ao");
            if (albedo != null) material.SetTexture("_MainTex", albedo);
            if (normal != null)
            {
                material.SetTexture("_BumpMap", normal);
                material.SetFloat("_BumpScale", .85f);
                material.EnableKeyword("_NORMALMAP");
            }
            if (metallic != null)
            {
                material.SetTexture("_MetallicGlossMap", metallic);
                material.SetFloat("_GlossMapScale", 1f);
                material.EnableKeyword("_METALLICGLOSSMAP");
            }
            if (ao != null)
            {
                material.SetTexture("_OcclusionMap", ao);
                material.SetFloat("_OcclusionStrength", .82f);
            }
            Texture2D detailAlbedo = Texture("detail_albedo");
            Texture2D detailNormal = Texture("detail_normal");
            if (detailAlbedo != null && detailNormal != null)
            {
                material.SetTexture("_DetailAlbedoMap", detailAlbedo);
                material.SetTexture("_DetailNormalMap", detailNormal);
                material.detailAlbedoMapScale = 6f;
                material.detailNormalMapScale = .28f;
                material.EnableKeyword("_DETAIL_MULX2");
            }
            material.mainTextureScale = tiling;
            return material;
        }

        private static Material CreateWater(string name)
        {
            Material material = Standard(name, new Color(.035f, .055f, .065f, .72f));
            material.SetFloat("_Metallic", 0f);
            material.SetFloat("_Glossiness", .88f);
            material.SetFloat("_Mode", 2f); // Standard Fade: alpha blended, no depth writes.
            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0);
            material.DisableKeyword("_ALPHATEST_ON");
            material.EnableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            return material;
        }

        private static Material CreateSolidMetal(string name, Color color, float metallic, float smoothness)
        {
            Material material = Standard(name, color);
            material.SetFloat("_Metallic", metallic);
            material.SetFloat("_Glossiness", smoothness);
            Texture2D normal = Texture("metal_normal");
            if (normal != null)
            {
                material.SetTexture("_BumpMap", normal);
                material.SetFloat("_BumpScale", .42f);
                material.EnableKeyword("_NORMALMAP");
            }
            return material;
        }

        private static Material CreateSolid(string name, Color color, float metallic, float smoothness, bool texturedNormal)
        {
            Material material = Standard(name, color);
            material.SetFloat("_Metallic", metallic);
            material.SetFloat("_Glossiness", smoothness);
            if (texturedNormal)
            {
                Texture2D normal = Texture("stone_normal");
                if (normal != null)
                {
                    material.SetTexture("_BumpMap", normal);
                    material.SetFloat("_BumpScale", .35f);
                    material.EnableKeyword("_NORMALMAP");
                }
            }
            return material;
        }

        private static Material CreateEmission(string name, Color color, Color emission)
        {
            Material material = Standard(name, color);
            material.SetFloat("_Glossiness", .48f);
            material.SetColor("_EmissionColor", emission);
            material.EnableKeyword("_EMISSION");
            return material;
        }

        private static Material CreateParticle(string name, string textureName, bool additive)
        {
            Shader shader = additive
                ? Shader.Find("Legacy Shaders/Particles/Additive") ?? Shader.Find("Sprites/Default")
                : Shader.Find("Legacy Shaders/Particles/Alpha Blended") ?? Shader.Find("Sprites/Default");
            Material material = new Material(shader) { name = "Forge " + name, enableInstancing = true };
            Texture2D texture = Texture(textureName);
            if (texture != null) material.SetTexture("_MainTex", texture);
            material.SetColor("_TintColor", additive ? new Color(1f, .48f, .08f, 1f) : new Color(.58f, .64f, .7f, .42f));
            material.color = additive ? new Color(1f, .65f, .18f, 1f) : new Color(.65f, .7f, .76f, .48f);
            return material;
        }

        private static Material Standard(string name, Color color)
        {
            Material material = new Material(Shader.Find("Standard"))
            {
                name = "Forge " + name,
                color = color,
                enableInstancing = true
            };
            material.SetFloat("_Glossiness", .28f);
            material.SetFloat("_Metallic", 0f);
            return material;
        }

        private static Texture2D Texture(string name)
        {
            return Resources.Load<Texture2D>(ResourceRoot + "/Textures/" + name);
        }
    }
}
