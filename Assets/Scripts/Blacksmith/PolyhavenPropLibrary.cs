using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>
    /// Loads the small set of CC0, UV-mapped prop meshes imported from Poly Haven.
    /// Materials are rebuilt explicitly so glTF ARM maps cannot be misinterpreted
    /// as Unity Standard metallic/smoothness maps. A missing asset returns null;
    /// the architectural builder can then retain its deterministic fallback.
    /// </summary>
    public static class PolyhavenPropLibrary
    {
        private const string ModelRoot = "BlacksmithExterior/Models/";
        private const string TextureRoot = "BlacksmithExterior/Textures/Imported/";
        private static readonly Dictionary<string, Material> MaterialCache = new Dictionary<string, Material>();

        public static GameObject Instantiate(string modelName, Transform parent, Vector3 position,
            Quaternion rotation, float scale = 1f)
        {
            GameObject prefab = Resources.Load<GameObject>(ModelRoot + modelName);
            if (prefab == null) return null;
            GameObject instance = Object.Instantiate(prefab, parent, false);
            instance.name = "CC0 • " + modelName;
            instance.transform.localPosition = position;
            instance.transform.localRotation = rotation;
            instance.transform.localScale = Vector3.one * scale;
            ApplyPbrMaterials(instance, modelName);
            if (modelName == "treasure_chest") ConfigureChestLod(instance);
            return instance;
        }

        private static void ConfigureChestLod(GameObject instance)
        {
            Renderer[] high = instance.GetComponentsInChildren<Renderer>(true);
            GameObject proxy = new GameObject("Chest distant proxy");
            proxy.transform.SetParent(instance.transform, false);
            proxy.transform.localPosition = new Vector3(0f, .31f, 0f);
            proxy.transform.localScale = new Vector3(1f, .65f, .55f);
            proxy.AddComponent<MeshFilter>().sharedMesh = BlacksmithMeshUtility.CreateBeveledBox(.08f);
            Material material = new Material(Shader.Find("Standard")) { color = new Color(.16f, .075f, .03f), enableInstancing = true };
            Renderer lowRenderer = proxy.AddComponent<MeshRenderer>();
            lowRenderer.sharedMaterial = material;
            LODGroup lod = instance.AddComponent<LODGroup>();
            lod.fadeMode = LODFadeMode.CrossFade;
            lod.animateCrossFading = true;
            lod.SetLODs(new[]
            {
                new LOD(.58f, high),
                new LOD(.12f, new[] { lowRenderer }),
                new LOD(0f, new Renderer[0])
            });
            lod.RecalculateBounds();
        }

        private static void ApplyPbrMaterials(GameObject instance, string modelName)
        {
            foreach (Renderer renderer in instance.GetComponentsInChildren<Renderer>(true))
            {
                Material[] source = renderer.sharedMaterials;
                if (source == null || source.Length == 0)
                {
                    renderer.sharedMaterial = GetMaterial(modelName);
                    continue;
                }
                Material[] replacement = new Material[source.Length];
                for (int i = 0; i < source.Length; i++)
                {
                    string key = MaterialKey(source[i], modelName);
                    replacement[i] = GetMaterial(key);
                }
                renderer.sharedMaterials = replacement;
            }
        }

        private static string MaterialKey(Material material, string fallback)
        {
            if (material == null) return fallback;
            string key = material.name.Replace(" (Instance)", string.Empty).Replace(" (Clone)", string.Empty);
            // OBJ importers can prefix a material with the model name only once.
            return key.StartsWith(fallback, System.StringComparison.Ordinal) ? key : fallback;
        }

        private static Material GetMaterial(string key)
        {
            if (MaterialCache.TryGetValue(key, out Material cached) && cached != null) return cached;
            Material material = new Material(Shader.Find("Standard"))
            {
                name = "PBR • " + key,
                enableInstancing = true
            };
            Texture2D albedo = Load(key + "_albedo");
            Texture2D normal = Load(key + "_normal");
            Texture2D metallic = Load(key + "_metallic_smoothness");
            Texture2D ao = Load(key + "_ao");
            if (albedo != null) material.SetTexture("_MainTex", albedo);
            if (normal != null)
            {
                material.SetTexture("_BumpMap", normal);
                material.SetFloat("_BumpScale", .72f);
                material.EnableKeyword("_NORMALMAP");
            }
            if (metallic != null)
            {
                material.SetTexture("_MetallicGlossMap", metallic);
                material.SetFloat("_GlossMapScale", 1f);
                material.EnableKeyword("_METALLICGLOSSMAP");
            }
            else
            {
                material.SetFloat("_Metallic", key.Contains("glass") ? .08f : .15f);
                material.SetFloat("_Glossiness", key.Contains("glass") ? .82f : .48f);
            }
            if (ao != null)
            {
                material.SetTexture("_OcclusionMap", ao);
                material.SetFloat("_OcclusionStrength", .85f);
            }
            if (key.Contains("glass"))
            {
                // Keep the lantern glass opaque enough for mobile depth sorting;
                // its real light and emissive tint provide the warm glow.
                material.SetColor("_EmissionColor", new Color(1f, .22f, .025f) * .32f);
                material.EnableKeyword("_EMISSION");
            }
            MaterialCache[key] = material;
            return material;
        }

        private static Texture2D Load(string name)
        {
            return Resources.Load<Texture2D>(TextureRoot + name);
        }
    }
}
