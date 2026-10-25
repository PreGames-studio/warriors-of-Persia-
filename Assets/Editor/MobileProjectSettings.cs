#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

/// <summary>Applies the game's mobile-first landscape defaults when Unity opens the project.</summary>
[InitializeOnLoad]
public static class MobileProjectSettings
{
    static MobileProjectSettings()
    {
        EditorApplication.delayCall += Apply;
    }

    private static void Apply()
    {
        PlayerSettings.productName = "Warriors of Persia";
        PlayerSettings.companyName = "PreGames Studio";
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
        PlayerSettings.allowedAutorotateToLandscapeLeft = true;
        PlayerSettings.allowedAutorotateToLandscapeRight = true;
        PlayerSettings.allowedAutorotateToPortrait = false;
        PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.pregamesstudio.warriorsofpersia");
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel23;
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        // Built-in mobile supports Linear on the project's ARM64 / API23+
        // target; it keeps PBR light and warm forge emission physically coherent.
        PlayerSettings.colorSpace = ColorSpace.Linear;
    }
}
#endif
