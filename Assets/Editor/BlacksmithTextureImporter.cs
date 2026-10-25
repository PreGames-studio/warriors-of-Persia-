#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

/// <summary>Correct 2K/1K, linear/normal import settings for forge and ground PBR maps.</summary>
public sealed class BlacksmithTextureImporter : AssetPostprocessor
{
    private void OnPreprocessTexture()
    {
        string path = assetPath.Replace('\\', '/');
        bool imported = path.Contains("BlacksmithExterior/Textures/Imported/");
        if (!path.Contains("BlacksmithExterior/Textures/")) return;
        TextureImporter importer = (TextureImporter)assetImporter;
        string file = System.IO.Path.GetFileNameWithoutExtension(path);
        importer.mipmapEnabled = true;
        // Main architectural maps are authored at 2K. Imported props are 1K
        // source maps; never upscale them, but retain their full resolution.
        importer.maxTextureSize = 2048;
        importer.filterMode = FilterMode.Bilinear;
        importer.anisoLevel = imported ? 8 : 4;
        importer.wrapMode = TextureWrapMode.Repeat;
        importer.textureCompression = TextureImporterCompression.Compressed;
        importer.isReadable = false;
        importer.alphaSource = TextureImporterAlphaSource.InputTextureAlpha;

        if (file.EndsWith("_normal"))
        {
            importer.textureType = TextureImporterType.NormalMap;
            importer.sRGBTexture = false;
        }
        else if (file.EndsWith("_metallic_smoothness") || file.EndsWith("_ao"))
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = false;
            importer.alphaIsTransparency = false;
        }
        else if (file == "smoke" || file == "spark")
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = true;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.maxTextureSize = 128;
        }
        else
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = true;
        }
    }
}
#endif
