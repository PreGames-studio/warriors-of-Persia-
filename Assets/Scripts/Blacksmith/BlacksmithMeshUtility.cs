using System.Collections.Generic;
using UnityEngine;

namespace WarriorsOfPersia.Blacksmith
{
    /// <summary>Small, shared meshes used by the procedural forge. No external model files are required.</summary>
    public static class BlacksmithMeshUtility
    {
        private sealed class MeshBuilder
        {
            private readonly List<Vector3> vertices = new List<Vector3>();
            private readonly List<Vector3> normals = new List<Vector3>();
            private readonly List<Vector2> uv = new List<Vector2>();
            private readonly List<int> triangles = new List<int>();

            public void AddQuad(IList<Vector3> points, Vector3 desiredNormal)
            {
                AddFace(points, desiredNormal, true);
            }

            public void AddTriangle(IList<Vector3> points, Vector3 desiredNormal)
            {
                AddFace(points, desiredNormal, false);
            }

            private void AddFace(IList<Vector3> points, Vector3 desiredNormal, bool quad)
            {
                Vector3[] ordered = new Vector3[points.Count];
                for (int i = 0; i < points.Count; i++) ordered[i] = points[i];
                Vector3 cross = Vector3.Cross(ordered[1] - ordered[0], ordered[2] - ordered[0]);
                if (Vector3.Dot(cross, desiredNormal) < 0f)
                {
                    System.Array.Reverse(ordered);
                }

                int start = vertices.Count;
                Vector3 normal = desiredNormal.normalized;
                for (int i = 0; i < ordered.Length; i++)
                {
                    vertices.Add(ordered[i]);
                    normals.Add(normal);
                }
                if (quad)
                {
                    uv.Add(new Vector2(0f, 0f));
                    uv.Add(new Vector2(1f, 0f));
                    uv.Add(new Vector2(1f, 1f));
                    uv.Add(new Vector2(0f, 1f));
                    triangles.Add(start); triangles.Add(start + 2); triangles.Add(start + 1);
                    triangles.Add(start); triangles.Add(start + 3); triangles.Add(start + 2);
                }
                else
                {
                    uv.Add(new Vector2(0f, 0f));
                    uv.Add(new Vector2(1f, 0f));
                    uv.Add(new Vector2(.5f, 1f));
                    triangles.Add(start); triangles.Add(start + 2); triangles.Add(start + 1);
                }
            }

            public Mesh ToMesh(string name)
            {
                Mesh mesh = new Mesh { name = name };
                mesh.SetVertices(vertices);
                mesh.SetNormals(normals);
                mesh.SetUVs(0, uv);
                mesh.SetTriangles(triangles, 0, true);
                mesh.RecalculateBounds();
                return mesh;
            }
        }

        public static Mesh CreateBeveledBox(float bevel = .055f)
        {
            MeshBuilder builder = new MeshBuilder();
            bevel = Mathf.Clamp(bevel, .01f, .2f);
            float inner = .5f - bevel;

            for (int axis = 0; axis < 3; axis++)
            {
                int b = (axis + 1) % 3;
                int c = (axis + 2) % 3;
                for (int sign = -1; sign <= 1; sign += 2)
                {
                    Vector3 center = Vector3.zero;
                    center[axis] = sign * .5f;
                    Vector3 ub = Vector3.zero; ub[b] = inner;
                    Vector3 uc = Vector3.zero; uc[c] = inner;
                    Vector3 normal = Vector3.zero; normal[axis] = sign;
                    builder.AddQuad(new[]
                    {
                        center - ub - uc, center + ub - uc,
                        center + ub + uc, center - ub + uc
                    }, normal);
                }

                for (int signA = -1; signA <= 1; signA += 2)
                for (int signB = -1; signB <= 1; signB += 2)
                {
                    Vector3 normal = Vector3.zero;
                    normal[axis] = signA;
                    normal[b] = signB;
                    Vector3 a0 = Vector3.zero, b0 = Vector3.zero, a1 = Vector3.zero, b1 = Vector3.zero;
                    a0[axis] = signA * .5f; a0[b] = signB * inner; a0[c] = -inner;
                    b0[axis] = signA * inner; b0[b] = signB * .5f; b0[c] = -inner;
                    a1[axis] = signA * .5f; a1[b] = signB * inner; a1[c] = inner;
                    b1[axis] = signA * inner; b1[b] = signB * .5f; b1[c] = inner;
                    builder.AddQuad(new[] { a0, b0, b1, a1 }, normal);
                }
            }

            for (int x = -1; x <= 1; x += 2)
            for (int y = -1; y <= 1; y += 2)
            for (int z = -1; z <= 1; z += 2)
            {
                Vector3 a = new Vector3(x * .5f, y * inner, z * inner);
                Vector3 b = new Vector3(x * inner, y * .5f, z * inner);
                Vector3 c = new Vector3(x * inner, y * inner, z * .5f);
                builder.AddTriangle(new[] { a, b, c }, new Vector3(x, y, z));
            }
            return builder.ToMesh("Forge beveled block");
        }

        public static Mesh CreateIrregularStone(int seed = 0)
        {
            Mesh mesh = CreateBeveledBox(.085f);
            Vector3[] vertices = mesh.vertices;
            System.Random rng = new System.Random(seed);
            for (int i = 0; i < vertices.Length; i++)
            {
                Vector3 value = vertices[i];
                // Small, deterministic chipping keeps the silhouette irregular
                // without opening large cracks in the bevelled stone.
                value.x += ((float)rng.NextDouble() - .5f) * .055f;
                value.y += ((float)rng.NextDouble() - .5f) * .045f;
                value.z += ((float)rng.NextDouble() - .5f) * .055f;
                vertices[i] = value;
            }
            mesh.vertices = vertices;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            mesh.name = "Hand-chipped irregular ashlar";
            return mesh;
        }

        public static Mesh CreateGablePrism()
        {
            MeshBuilder builder = new MeshBuilder();
            Vector3[] front = { new Vector3(-.5f, -.5f, .5f), new Vector3(.5f, -.5f, .5f), new Vector3(0f, .5f, .5f) };
            Vector3[] back = { new Vector3(-.5f, -.5f, -.5f), new Vector3(.5f, -.5f, -.5f), new Vector3(0f, .5f, -.5f) };
            builder.AddTriangle(front, Vector3.forward);
            builder.AddTriangle(back, Vector3.back);
            for (int i = 0; i < 3; i++)
            {
                int next = (i + 1) % 3;
                Vector3 midpoint = (front[i] + front[next]) * .5f;
                builder.AddQuad(new[] { front[i], back[i], back[next], front[next] }, new Vector3(midpoint.x, midpoint.y, 0f));
            }
            return builder.ToMesh("Forge gable prism");
        }

        public static Mesh CreateShield()
        {
            MeshBuilder builder = new MeshBuilder();
            Vector2[] shape =
            {
                new Vector2(-.5f, .55f), new Vector2(.5f, .55f),
                new Vector2(.46f, -.12f), new Vector2(0f, -.65f), new Vector2(-.46f, -.12f)
            };
            const float depth = .12f;
            Vector3 frontCenter = new Vector3(0f, 0f, depth * .5f);
            Vector3 backCenter = new Vector3(0f, 0f, -depth * .5f);
            for (int i = 0; i < shape.Length; i++)
            {
                int next = (i + 1) % shape.Length;
                Vector3 a = new Vector3(shape[i].x, shape[i].y, depth * .5f);
                Vector3 b = new Vector3(shape[next].x, shape[next].y, depth * .5f);
                Vector3 c = new Vector3(shape[i].x, shape[i].y, -depth * .5f);
                Vector3 d = new Vector3(shape[next].x, shape[next].y, -depth * .5f);
                builder.AddTriangle(new[] { frontCenter, a, b }, Vector3.forward);
                builder.AddTriangle(new[] { backCenter, c, d }, Vector3.back);
                Vector2 mid = (shape[i] + shape[next]) * .5f;
                builder.AddQuad(new[] { a, c, d, b }, new Vector3(mid.x, mid.y, 0f));
            }
            return builder.ToMesh("Forged heater shield");
        }

        public static Mesh CreateBlade()
        {
            MeshBuilder builder = new MeshBuilder();
            const float width = .12f;
            const float thickness = .035f;
            Vector3[] lower =
            {
                new Vector3(-width, 0f, 0f), new Vector3(0f, 0f, thickness),
                new Vector3(width, 0f, 0f), new Vector3(0f, 0f, -thickness)
            };
            Vector3[] upper =
            {
                new Vector3(-width * .72f, 1.05f, 0f), new Vector3(0f, 1.05f, thickness * .72f),
                new Vector3(width * .72f, 1.05f, 0f), new Vector3(0f, 1.05f, -thickness * .72f)
            };
            Vector3 tip = new Vector3(0f, 1.42f, 0f);
            for (int i = 0; i < 4; i++)
            {
                int next = (i + 1) % 4;
                Vector3 radial = (lower[i] + lower[next]).normalized;
                builder.AddQuad(new[] { lower[i], lower[next], upper[next], upper[i] }, radial);
                builder.AddTriangle(new[] { upper[i], upper[next], tip }, radial + Vector3.up * .15f);
            }
            builder.AddQuad(new[] { lower[3], lower[2], lower[1], lower[0] }, Vector3.down);
            return builder.ToMesh("Diamond forged sword blade");
        }

        public static Mesh CreateCylinder(int segments = 12, float topRadiusRatio = 1f)
        {
            MeshBuilder builder = new MeshBuilder();
            segments = Mathf.Clamp(segments, 6, 24);
            Vector3[] lower = new Vector3[segments];
            Vector3[] upper = new Vector3[segments];
            for (int i = 0; i < segments; i++)
            {
                float angle = i * Mathf.PI * 2f / segments;
                lower[i] = new Vector3(Mathf.Cos(angle) * .5f, -.5f, Mathf.Sin(angle) * .5f);
                upper[i] = new Vector3(Mathf.Cos(angle) * .5f * topRadiusRatio, .5f, Mathf.Sin(angle) * .5f * topRadiusRatio);
            }
            Vector3 topCenter = new Vector3(0f, .5f, 0f);
            Vector3 bottomCenter = new Vector3(0f, -.5f, 0f);
            for (int i = 0; i < segments; i++)
            {
                int next = (i + 1) % segments;
                Vector3 radial = new Vector3(lower[i].x + lower[next].x, 0f, lower[i].z + lower[next].z).normalized;
                if (topRadiusRatio <= .001f)
                {
                    builder.AddTriangle(new[] { lower[i], lower[next], topCenter }, radial + Vector3.up * .35f);
                }
                else
                {
                    builder.AddQuad(new[] { lower[i], lower[next], upper[next], upper[i] }, radial);
                    builder.AddTriangle(new[] { topCenter, upper[i], upper[next] }, Vector3.up);
                }
                builder.AddTriangle(new[] { bottomCenter, lower[next], lower[i] }, Vector3.down);
            }
            return builder.ToMesh(topRadiusRatio <= .001f ? "Forged cone" : "Low sided cylinder");
        }

        public static Mesh CreateTorus(int majorSegments = 20, int tubeSegments = 6, float tubeRatio = .18f)
        {
            MeshBuilder builder = new MeshBuilder();
            for (int u = 0; u < majorSegments; u++)
            for (int v = 0; v < tubeSegments; v++)
            {
                Vector3[] points = new Vector3[4];
                Vector3[] normals = new Vector3[4];
                int[] uSteps = { u, u + 1, u + 1, u };
                int[] vSteps = { v, v, v + 1, v + 1 };
                for (int i = 0; i < 4; i++)
                {
                    float a = uSteps[i] * Mathf.PI * 2f / majorSegments;
                    float b = vSteps[i] * Mathf.PI * 2f / tubeSegments;
                    Vector3 radial = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f);
                    points[i] = radial * (1f + tubeRatio * Mathf.Cos(b)) + Vector3.forward * (tubeRatio * Mathf.Sin(b));
                    normals[i] = radial * Mathf.Cos(b) + Vector3.forward * Mathf.Sin(b);
                }
                Vector3 averageNormal = (normals[0] + normals[1] + normals[2] + normals[3]).normalized;
                builder.AddQuad(points, averageNormal);
            }
            return builder.ToMesh("Forged iron ring");
        }
    }
}
