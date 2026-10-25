using UnityEngine;

/// <summary>
/// One-pass Built-in color grade with an optional four-tap depth AO. This is
/// deliberately small enough for the existing mobile camera and has a blit
/// fallback if a device cannot compile the shader.
/// </summary>
[RequireComponent(typeof(Camera))]
public sealed class CinematicPostProcess : MonoBehaviour
{
    private Camera targetCamera;
    private Material grade;
    private bool aoEnabled;

    public void Configure(bool highQuality)
    {
        targetCamera = GetComponent<Camera>();
        aoEnabled = highQuality;
        if (aoEnabled) targetCamera.depthTextureMode |= DepthTextureMode.Depth;
        Shader shader = Shader.Find("Hidden/WarriorsOfPersia/CinematicGrade");
        if (shader != null && shader.isSupported)
        {
            grade = new Material(shader) { name = "Cinematic grade (mobile)" };
            grade.SetFloat("_Exposure", 1.08f);
            grade.SetFloat("_Contrast", 1.055f);
            grade.SetFloat("_Saturation", 1.045f);
            grade.SetFloat("_Vignette", .13f);
            grade.SetFloat("_AOStrength", highQuality ? .24f : 0f);
            grade.SetFloat("_AOEnabled", highQuality ? 1f : 0f);
        }
    }

    private void OnRenderImage(RenderTexture source, RenderTexture destination)
    {
        if (grade == null)
        {
            Graphics.Blit(source, destination);
            return;
        }
        Graphics.Blit(source, destination, grade);
    }

    private void OnDestroy()
    {
        if (grade != null) Destroy(grade);
    }
}
