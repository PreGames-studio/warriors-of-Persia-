using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>Low-cost firelight flicker; no per-frame allocations and no extra shadow passes.</summary>
    public sealed class BlacksmithAtmosphere : MonoBehaviour
    {
        private Light[] lights;
        private float[] baseIntensities;
        private Transform[] flames;
        private Vector3[] baseFlameScales;
        private float seed;

        public void Configure(params Light[] flickeringLights)
        {
            lights = flickeringLights;
            baseIntensities = new float[lights.Length];
            for (int i = 0; i < lights.Length; i++) baseIntensities[i] = lights[i] != null ? lights[i].intensity : 0f;
            seed = transform.position.x * .137 + transform.position.z * .193;
        }

        public void ConfigureFlames(params Transform[] flameTransforms)
        {
            flames = flameTransforms;
            baseFlameScales = new Vector3[flames.Length];
            for (int i = 0; i < flames.Length; i++) baseFlameScales[i] = flames[i] != null ? flames[i].localScale : Vector3.one;
        }

        private void Start()
        {
            if (lights == null)
            {
                Configure(GetComponentsInChildren<Light>(true));
            }
            if (flames == null)
            {
                List<Transform> savedFlames = new List<Transform>();
                Transform[] children = GetComponentsInChildren<Transform>(true);
                foreach (Transform child in children)
                {
                    if (child.name.StartsWith("Living forge flame")) savedFlames.Add(child);
                }
                ConfigureFlames(savedFlames.ToArray());
            }
        }

        private void Update()
        {
            float time = Time.time + seed;
            if (lights != null)
            {
                for (int i = 0; i < lights.Length; i++)
                {
                    if (lights[i] == null) continue;
                    float slow = Mathf.PerlinNoise(time * 2.2f, i * 3.17f);
                    float fast = Mathf.PerlinNoise(time * 7.1f, i * 5.31f);
                    lights[i].intensity = baseIntensities[i] * Mathf.Lerp(.84f, 1.15f, slow * .72f + fast * .28f);
                }
            }
            if (flames != null)
            {
                for (int i = 0; i < flames.Length; i++)
                {
                    if (flames[i] == null) continue;
                    float pulse = .82f + Mathf.PerlinNoise(time * 5.4f, i * 1.93f) * .42f;
                    Vector3 scale = baseFlameScales[i];
                    flames[i].localScale = new Vector3(scale.x * (1.04f - pulse * .08f), scale.y * pulse, scale.z * (1.04f - pulse * .08f));
                }
            }
        }
    }
}
