using System.Collections.Generic;
using UnityEngine;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Paleta de cores de um modelo, indexada por <see cref="MaterialSlot"/>.</summary>
    public struct ModelPalette
    {
        public Color Wall;
        public Color Roof;
        public Color Accent;
        public Color Glass;
        public Color Trim;
        public Color Metal;
        public Color Foliage;
        public Color Ground;

        public static ModelPalette Create(Color wall, Color roof, Color accent)
        {
            return new ModelPalette
            {
                Wall = wall,
                Roof = roof,
                Accent = accent,
                Glass = new Color(0.42f, 0.62f, 0.78f),
                Trim = new Color(0.28f, 0.27f, 0.27f),
                Metal = new Color(0.66f, 0.68f, 0.71f),
                Foliage = new Color(0.33f, 0.58f, 0.3f),
                Ground = new Color(0.74f, 0.73f, 0.7f),
            };
        }

        public Color Get(MaterialSlot slot)
        {
            switch (slot)
            {
                case MaterialSlot.Wall: return Wall;
                case MaterialSlot.Roof: return Roof;
                case MaterialSlot.Glass: return Glass;
                case MaterialSlot.Accent: return Accent;
                case MaterialSlot.Trim: return Trim;
                case MaterialSlot.Metal: return Metal;
                case MaterialSlot.Foliage: return Foliage;
                case MaterialSlot.Ground: return Ground;
                default: return Color.magenta;
            }
        }

        public static float Smoothness(MaterialSlot slot)
        {
            switch (slot)
            {
                case MaterialSlot.Glass: return 0.85f;
                case MaterialSlot.Metal: return 0.55f;
                case MaterialSlot.Accent: return 0.35f;
                default: return 0.12f;
            }
        }
    }

    /// <summary>
    /// Cria e reaproveita materiais por cor a partir de um material-modelo (URP Simple Lit).
    /// Reaproveitar instâncias mantém o SRP Batcher eficiente e evita vazamento de materiais.
    /// </summary>
    public sealed class MaterialLibrary
    {
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int SmoothnessId = Shader.PropertyToID("_Smoothness");
        private static readonly int GlossinessId = Shader.PropertyToID("_Glossiness");

        private readonly Material _template;
        private readonly Dictionary<long, Material> _cache = new Dictionary<long, Material>();

        public MaterialLibrary(Material template)
        {
            _template = template != null ? template : CreateFallbackTemplate();
        }

        public bool HasValidTemplate => _template != null;

        private static Material CreateFallbackTemplate()
        {
            // Funciona no Editor; em builds o material-modelo do GameDatabase garante que o shader seja incluído.
            Shader shader = Shader.Find("Universal Render Pipeline/Simple Lit");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null)
            {
                Debug.LogError("[EmpireTycoon] Nenhum shader encontrado. Execute 'Empire Tycoon > Configurar Projeto'.");
                return null;
            }
            Debug.LogWarning("[EmpireTycoon] GameDatabase sem material-modelo; usando shader '" + shader.name + "'.");
            return new Material(shader) { name = "RuntimeTemplate" };
        }

        public Material Get(Color color, float smoothness = 0.12f)
        {
            Color32 c = color;
            int s = Mathf.Clamp(Mathf.RoundToInt(smoothness * 100f), 0, 100);
            long key = ((long)c.r << 32) | ((long)c.g << 24) | ((long)c.b << 16) | ((long)c.a << 8) | (long)s;
            if (_cache.TryGetValue(key, out var mat)) return mat;

            mat = new Material(_template) { name = "M_" + ColorUtility.ToHtmlStringRGB(color) + "_" + s };
            if (mat.HasProperty(BaseColorId)) mat.SetColor(BaseColorId, color);
            if (mat.HasProperty(ColorId)) mat.SetColor(ColorId, color);
            if (mat.HasProperty(SmoothnessId)) mat.SetFloat(SmoothnessId, smoothness);
            if (mat.HasProperty(GlossinessId)) mat.SetFloat(GlossinessId, smoothness);
            _cache.Add(key, mat);
            return mat;
        }

        public Material[] ForSlots(MaterialSlot[] slots, in ModelPalette palette)
        {
            var result = new Material[slots.Length];
            for (int i = 0; i < slots.Length; i++)
                result[i] = Get(palette.Get(slots[i]), ModelPalette.Smoothness(slots[i]));
            return result;
        }

        public void DestroyAll()
        {
            foreach (var m in _cache.Values) Object.Destroy(m);
            _cache.Clear();
        }
    }
}
