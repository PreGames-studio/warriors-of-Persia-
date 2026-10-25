#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

/// <summary>Conservative, mobile-friendly import settings for the CC0 OBJ props.</summary>
public sealed class PolyhavenModelImporter : AssetPostprocessor
{
    private void OnPreprocessModel()
    {
        string path = assetPath.Replace('\\', '/');
        if (!path.StartsWith("Assets/Resources/BlacksmithExterior/Models/", System.StringComparison.Ordinal)) return;
        if (!path.EndsWith(".obj", System.StringComparison.OrdinalIgnoreCase)) return;
        ModelImporter importer = (ModelImporter)assetImporter;
        importer.globalScale = 1f;
        importer.importNormals = ModelImporterNormals.Import;
        importer.importTangents = ModelImporterTangents.CalculateMikk;
        importer.materialImportMode = ModelImporterMaterialImportMode.Import;
        importer.materialLocation = ModelImporterMaterialLocation.External;
        importer.optimizeMeshVertices = true;
        importer.meshCompression = ModelImporterMeshCompression.Off;
        importer.importAnimation = false;
        importer.importCameras = false;
        importer.importLights = false;
    }
}
#endif
