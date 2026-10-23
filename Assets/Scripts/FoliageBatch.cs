using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

/// <summary>Renders low-poly grass and shrubs in GPU batches for mobile performance.</summary>
public sealed class FoliageBatch : MonoBehaviour
{
    private Mesh mesh;
    private Material material;
    private readonly List<Matrix4x4> instances = new List<Matrix4x4>();
    private readonly Matrix4x4[] renderBatch = new Matrix4x4[1023];

    public void Configure(Mesh sourceMesh, Material sourceMaterial, List<Matrix4x4> transforms)
    {
        mesh = sourceMesh;
        material = sourceMaterial;
        instances.Clear();
        instances.AddRange(transforms);
        if (material != null)
            material.enableInstancing = true;
    }

    private void Update()
    {
        if (mesh == null || material == null || instances.Count == 0)
            return;

        int start = 0;
        while (start < instances.Count)
        {
            int count = Mathf.Min(renderBatch.Length, instances.Count - start);
            for (int i = 0; i < count; i++)
                renderBatch[i] = instances[start + i];

            Graphics.DrawMeshInstanced(
                mesh,
                0,
                material,
                renderBatch,
                count,
                null,
                ShadowCastingMode.Off,
                false,
                gameObject.layer
            );
            start += count;
        }
    }
}
