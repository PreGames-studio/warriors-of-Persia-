#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using WarriorsOfPersia.Blacksmith;

/// <summary>Editor construction and persistence for the real, editable blacksmith district.</summary>
public static class MedievalBlacksmithEditor
{
    private const string ResourceFolder = "Assets/Resources/BlacksmithExterior";
    private const string MaterialFolder = ResourceFolder + "/Materials";
    private const string MeshFolder = ResourceFolder + "/Meshes";

    [MenuItem("Warriors of Persia/Build Medieval Blacksmith District")]
    public static void BuildDistrict()
    {
        EnsureFolders();
        EnsureMaterialAssets();
        MedievalBlacksmithBuilder builder = Object.FindObjectOfType<MedievalBlacksmithBuilder>();
        if (builder == null)
        {
            GameObject district = new GameObject("Kaveh's medieval blacksmith district");
            GameObject field = GameObject.Find("Mobile Open Field");
            if (field != null) district.transform.SetParent(field.transform, false);
            Undo.RegisterCreatedObjectUndo(district, "Build medieval blacksmith district");
            builder = district.AddComponent<MedievalBlacksmithBuilder>();
        }
        if (!builder.Built && builder.GetComponentInChildren<BlacksmithDoor>() == null)
        {
            builder.Build(new Vector3(12f, 0f, -30f), 180f);
        }
        SaveGeneratedMeshesAndMaterials(builder);
        Selection.activeGameObject = builder.gameObject;
        EditorSceneManager.MarkSceneDirty(builder.gameObject.scene);
        FrameDistrict(builder);
        AssetDatabase.SaveAssets();
        Debug.Log("Medieval blacksmith built from real editable meshes. Save the scene to keep this editor layout; runtime construction is also available.");
    }

    [MenuItem("Warriors of Persia/Frame Medieval Blacksmith")]
    public static void FrameDistrict()
    {
        MedievalBlacksmithBuilder builder = Object.FindObjectOfType<MedievalBlacksmithBuilder>();
        if (builder != null) FrameDistrict(builder);
    }

    private static void EnsureFolders()
    {
        Directory.CreateDirectory(MaterialFolder);
        Directory.CreateDirectory(MeshFolder);
        AssetDatabase.Refresh();
    }

    private static void EnsureMaterialAssets()
    {
        foreach (string name in BlacksmithMaterialLibrary.MaterialNames)
        {
            string path = MaterialFolder + "/" + name + ".mat";
            if (AssetDatabase.LoadAssetAtPath<Material>(path) != null) continue;
            Material material = BlacksmithMaterialLibrary.CreateMaterial(name);
            AssetDatabase.CreateAsset(material, path);
        }
        AssetDatabase.SaveAssets();
    }

    private static void SaveGeneratedMeshesAndMaterials(MedievalBlacksmithBuilder builder)
    {
        HashSet<Object> processed = new HashSet<Object>();
        foreach (MeshFilter filter in builder.GetComponentsInChildren<MeshFilter>(true))
        {
            Mesh mesh = filter.sharedMesh;
            if (mesh == null || processed.Contains(mesh) || !string.IsNullOrEmpty(AssetDatabase.GetAssetPath(mesh))) continue;
            processed.Add(mesh);
            string name = Sanitize(filter.gameObject.name) + ".asset";
            AssetDatabase.CreateAsset(mesh, AssetDatabase.GenerateUniqueAssetPath(MeshFolder + "/" + name));
        }
        foreach (Renderer renderer in builder.GetComponentsInChildren<Renderer>(true))
        {
            foreach (Material material in renderer.sharedMaterials)
            {
                if (material == null || processed.Contains(material) || !string.IsNullOrEmpty(AssetDatabase.GetAssetPath(material))) continue;
                processed.Add(material);
                string name = Sanitize(material.name) + ".mat";
                AssetDatabase.CreateAsset(material, AssetDatabase.GenerateUniqueAssetPath(MaterialFolder + "/" + name));
            }
        }
        AssetDatabase.SaveAssets();
    }

    private static void FrameDistrict(MedievalBlacksmithBuilder builder)
    {
        SceneView view = SceneView.lastActiveSceneView;
        if (view == null) return;
        Vector3 pivot = builder.transform.TransformPoint(new Vector3(0f, 3.4f, .8f));
        view.LookAt(pivot, Quaternion.Euler(19f, -34f, 0f), 18f);
        view.Repaint();
    }

    private static string Sanitize(string value)
    {
        foreach (char invalid in Path.GetInvalidFileNameChars()) value = value.Replace(invalid, '_');
        return value.Replace(' ', '_').Replace('•', '_');
    }
}
#endif
