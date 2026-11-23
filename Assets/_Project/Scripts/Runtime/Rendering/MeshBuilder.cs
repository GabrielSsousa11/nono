using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Slots de material usados pelos modelos procedurais (índice de submesh).</summary>
    public enum MaterialSlot
    {
        Wall = 0,
        Roof = 1,
        Glass = 2,
        Accent = 3,
        Trim = 4,
        Metal = 5,
        Foliage = 6,
        Ground = 7,
        Count = 8,
    }

    /// <summary>
    /// Construtor de malhas low-poly com sombreamento plano (flat shading) e um submesh por
    /// <see cref="MaterialSlot"/>. A orientação dos triângulos é corrigida automaticamente
    /// a partir da normal externa informada, evitando faces invertidas.
    /// </summary>
    public sealed class MeshBuilder
    {
        private readonly List<Vector3> _vertices = new List<Vector3>(512);
        private readonly List<Vector3> _normals = new List<Vector3>(512);
        private readonly List<int>[] _triangles;

        public MeshBuilder()
        {
            _triangles = new List<int>[(int)MaterialSlot.Count];
            for (int i = 0; i < _triangles.Length; i++) _triangles[i] = new List<int>(256);
        }

        public int VertexCount => _vertices.Count;

        public void Clear()
        {
            _vertices.Clear();
            _normals.Clear();
            foreach (var t in _triangles) t.Clear();
        }

        public void AddTriangle(MaterialSlot slot, Vector3 a, Vector3 b, Vector3 c, Vector3 outward)
        {
            Vector3 n = Vector3.Cross(b - a, c - a);
            if (n.sqrMagnitude < 1e-12f) return;
            if (Vector3.Dot(n, outward) < 0f) { var t = b; b = c; c = t; n = -n; }
            n.Normalize();
            int i = _vertices.Count;
            _vertices.Add(a); _vertices.Add(b); _vertices.Add(c);
            _normals.Add(n); _normals.Add(n); _normals.Add(n);
            var tris = _triangles[(int)slot];
            tris.Add(i); tris.Add(i + 1); tris.Add(i + 2);
        }

        /// <summary>Quadrilátero plano a-b-c-d (em ordem ao redor do perímetro).</summary>
        public void AddQuad(MaterialSlot slot, Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 outward)
        {
            Vector3 n = Vector3.Cross(b - a, c - a);
            if (n.sqrMagnitude < 1e-12f) return;
            if (Vector3.Dot(n, outward) < 0f) { var t = b; b = d; d = t; n = -n; }
            n.Normalize();
            int i = _vertices.Count;
            _vertices.Add(a); _vertices.Add(b); _vertices.Add(c); _vertices.Add(d);
            _normals.Add(n); _normals.Add(n); _normals.Add(n); _normals.Add(n);
            var tris = _triangles[(int)slot];
            tris.Add(i); tris.Add(i + 1); tris.Add(i + 2);
            tris.Add(i); tris.Add(i + 2); tris.Add(i + 3);
        }

        /// <summary>Caixa alinhada aos eixos, definida pelo centro da base e tamanho.</summary>
        public void AddBox(MaterialSlot slot, Vector3 baseCenter, Vector3 size, bool bottom = false, MaterialSlot? topSlot = null)
        {
            float x0 = baseCenter.x - size.x * 0.5f, x1 = baseCenter.x + size.x * 0.5f;
            float z0 = baseCenter.z - size.z * 0.5f, z1 = baseCenter.z + size.z * 0.5f;
            float y0 = baseCenter.y, y1 = baseCenter.y + size.y;

            AddQuad(topSlot ?? slot, new Vector3(x0, y1, z0), new Vector3(x0, y1, z1), new Vector3(x1, y1, z1), new Vector3(x1, y1, z0), Vector3.up);
            if (bottom) AddQuad(slot, new Vector3(x0, y0, z0), new Vector3(x1, y0, z0), new Vector3(x1, y0, z1), new Vector3(x0, y0, z1), Vector3.down);
            AddQuad(slot, new Vector3(x0, y0, z0), new Vector3(x0, y1, z0), new Vector3(x1, y1, z0), new Vector3(x1, y0, z0), Vector3.back);
            AddQuad(slot, new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1), new Vector3(x0, y0, z1), Vector3.forward);
            AddQuad(slot, new Vector3(x0, y0, z1), new Vector3(x0, y1, z1), new Vector3(x0, y1, z0), new Vector3(x0, y0, z0), Vector3.left);
            AddQuad(slot, new Vector3(x1, y0, z0), new Vector3(x1, y1, z0), new Vector3(x1, y1, z1), new Vector3(x1, y0, z1), Vector3.right);
        }

        /// <summary>
        /// Telhado de duas águas com cumeeira ao longo do eixo X (empenas nas faces ±X).
        /// <paramref name="baseCenter"/> é o topo da parede; o beiral desce além da parede pelo <paramref name="overhang"/>.
        /// </summary>
        public void AddGableRoof(MaterialSlot roofSlot, MaterialSlot gableSlot, Vector3 baseCenter, float width, float depth, float height, float overhang = 0.3f)
        {
            float slope = height / (depth * 0.5f);
            float x0 = baseCenter.x - width * 0.5f - overhang, x1 = baseCenter.x + width * 0.5f + overhang;
            float z0 = baseCenter.z - depth * 0.5f - overhang, z1 = baseCenter.z + depth * 0.5f + overhang;
            float yWall = baseCenter.y, yEave = yWall - slope * overhang, yRidge = yWall + height;
            float zm = baseCenter.z;

            AddQuad(roofSlot, new Vector3(x0, yEave, z0), new Vector3(x0, yRidge, zm), new Vector3(x1, yRidge, zm), new Vector3(x1, yEave, z0), new Vector3(0, 1, -1));
            AddQuad(roofSlot, new Vector3(x0, yEave, z1), new Vector3(x1, yEave, z1), new Vector3(x1, yRidge, zm), new Vector3(x0, yRidge, zm), new Vector3(0, 1, 1));
            // Face inferior do telhado (visível sob o beiral).
            AddQuad(roofSlot, new Vector3(x0, yEave, z0), new Vector3(x1, yEave, z0), new Vector3(x1, yRidge, zm), new Vector3(x0, yRidge, zm), new Vector3(0, -1, 1));
            AddQuad(roofSlot, new Vector3(x0, yEave, z1), new Vector3(x0, yRidge, zm), new Vector3(x1, yRidge, zm), new Vector3(x1, yEave, z1), new Vector3(0, -1, -1));

            float gx0 = baseCenter.x - width * 0.5f, gx1 = baseCenter.x + width * 0.5f;
            float gz0 = baseCenter.z - depth * 0.5f, gz1 = baseCenter.z + depth * 0.5f;
            AddTriangle(gableSlot, new Vector3(gx0, yWall, gz0), new Vector3(gx0, yRidge, zm), new Vector3(gx0, yWall, gz1), Vector3.left);
            AddTriangle(gableSlot, new Vector3(gx1, yWall, gz0), new Vector3(gx1, yRidge, zm), new Vector3(gx1, yWall, gz1), Vector3.right);
        }

        /// <summary>Prisma de "dente de serra" (telhado industrial): face vertical envidraçada voltada para +Z.</summary>
        public void AddSawtooth(MaterialSlot roofSlot, MaterialSlot glassSlot, Vector3 baseCenter, float width, float depth, float height)
        {
            float x0 = baseCenter.x - width * 0.5f, x1 = baseCenter.x + width * 0.5f;
            float z0 = baseCenter.z - depth * 0.5f, z1 = baseCenter.z + depth * 0.5f;
            float y0 = baseCenter.y, y1 = y0 + height;
            AddQuad(roofSlot, new Vector3(x0, y0, z0), new Vector3(x0, y1, z1), new Vector3(x1, y1, z1), new Vector3(x1, y0, z0), new Vector3(0, 1, -1));
            AddQuad(glassSlot, new Vector3(x0, y0, z1), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1), Vector3.forward);
            AddTriangle(roofSlot, new Vector3(x0, y0, z0), new Vector3(x0, y1, z1), new Vector3(x0, y0, z1), Vector3.left);
            AddTriangle(roofSlot, new Vector3(x1, y0, z0), new Vector3(x1, y1, z1), new Vector3(x1, y0, z1), Vector3.right);
        }

        public void AddCylinder(MaterialSlot slot, Vector3 baseCenter, float radius, float height, int segments = 8, bool capTop = true)
        {
            segments = Mathf.Max(3, segments);
            Vector3 top = baseCenter + Vector3.up * height;
            for (int i = 0; i < segments; i++)
            {
                float a0 = i * Mathf.PI * 2f / segments, a1 = (i + 1) * Mathf.PI * 2f / segments;
                var d0 = new Vector3(Mathf.Cos(a0), 0, Mathf.Sin(a0)) * radius;
                var d1 = new Vector3(Mathf.Cos(a1), 0, Mathf.Sin(a1)) * radius;
                var mid = (d0 + d1) * 0.5f;
                AddQuad(slot, baseCenter + d0, baseCenter + d1, top + d1, top + d0, mid);
                if (capTop) AddTriangle(slot, top, top + d0, top + d1, Vector3.up);
            }
        }

        public void AddCone(MaterialSlot slot, Vector3 baseCenter, float radius, float height, int segments = 7)
        {
            segments = Mathf.Max(3, segments);
            Vector3 apex = baseCenter + Vector3.up * height;
            for (int i = 0; i < segments; i++)
            {
                float a0 = i * Mathf.PI * 2f / segments, a1 = (i + 1) * Mathf.PI * 2f / segments;
                var p0 = baseCenter + new Vector3(Mathf.Cos(a0), 0, Mathf.Sin(a0)) * radius;
                var p1 = baseCenter + new Vector3(Mathf.Cos(a1), 0, Mathf.Sin(a1)) * radius;
                var outward = ((p0 + p1) * 0.5f - baseCenter).normalized + Vector3.up * (radius / height);
                AddTriangle(slot, p0, p1, apex, outward);
                AddTriangle(slot, p0, baseCenter, p1, height > 0 ? Vector3.down : Vector3.up);
            }
        }

        /// <summary>Contorno retangular (4 barras) — usado para bordas de terreno e seleção.</summary>
        public void AddFrame(MaterialSlot slot, Vector3 center, float width, float depth, float thickness, float height)
        {
            float hw = width * 0.5f, hd = depth * 0.5f, t = thickness;
            AddBox(slot, center + new Vector3(0, 0, -hd + t * 0.5f), new Vector3(width, height, t));
            AddBox(slot, center + new Vector3(0, 0, hd - t * 0.5f), new Vector3(width, height, t));
            AddBox(slot, center + new Vector3(-hw + t * 0.5f, 0, 0), new Vector3(t, height, depth - 2 * t));
            AddBox(slot, center + new Vector3(hw - t * 0.5f, 0, 0), new Vector3(t, height, depth - 2 * t));
        }

        /// <summary>Gera a malha com apenas os submeshes usados; <paramref name="slots"/> indica o material de cada um.</summary>
        public Mesh Build(string name, out MaterialSlot[] slots)
        {
            var mesh = new Mesh { name = name };
            if (_vertices.Count > 65000) mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(_vertices);
            mesh.SetNormals(_normals);

            var used = new List<MaterialSlot>();
            for (int i = 0; i < _triangles.Length; i++)
                if (_triangles[i].Count > 0) used.Add((MaterialSlot)i);

            mesh.subMeshCount = used.Count;
            for (int s = 0; s < used.Count; s++)
                mesh.SetTriangles(_triangles[(int)used[s]], s, calculateBounds: false);

            mesh.RecalculateBounds();
            mesh.UploadMeshData(markNoLongerReadable: true);
            slots = used.ToArray();
            return mesh;
        }
    }
}
