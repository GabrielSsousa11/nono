using EmpireTycoon.Simulation.WorldMap;
using UnityEngine;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Cores do ambiente urbano (centralizadas para facilitar ajuste de direção de arte).</summary>
    public static class WorldPalette
    {
        public static readonly Color Grass = new Color(0.47f, 0.66f, 0.36f);
        public static readonly Color Asphalt = new Color(0.25f, 0.26f, 0.28f);
        public static readonly Color RoadMarking = new Color(0.95f, 0.93f, 0.85f);
        public static readonly Color Sidewalk = new Color(0.78f, 0.77f, 0.74f);
        public static readonly Color PlayerOwned = new Color(0.62f, 0.76f, 0.93f);
        public static readonly Color PlayerBrand = new Color(0.16f, 0.45f, 0.9f);
        public static readonly Color Selection = new Color(1f, 0.78f, 0.15f);
        public static readonly Color ConstructionDirt = new Color(0.55f, 0.44f, 0.32f);
        public static readonly Color SafetyOrange = new Color(0.98f, 0.55f, 0.1f);
        public static readonly Color CraneYellow = new Color(0.98f, 0.8f, 0.15f);
        public static readonly Color Wood = new Color(0.62f, 0.47f, 0.3f);
        public static readonly Color Sky = new Color(0.62f, 0.78f, 0.92f);

        private static readonly Color[] WallColors =
        {
            new Color(0.94f, 0.9f, 0.82f), new Color(0.86f, 0.62f, 0.5f), new Color(0.7f, 0.8f, 0.88f),
            new Color(0.82f, 0.82f, 0.8f), new Color(0.9f, 0.8f, 0.6f), new Color(0.72f, 0.86f, 0.76f),
            new Color(0.93f, 0.7f, 0.66f), new Color(0.98f, 0.96f, 0.92f),
        };

        private static readonly Color[] RoofColors =
        {
            new Color(0.32f, 0.33f, 0.36f), new Color(0.62f, 0.3f, 0.22f), new Color(0.3f, 0.38f, 0.5f), new Color(0.45f, 0.35f, 0.28f),
        };

        private static readonly Color[] AccentColors =
        {
            new Color(0.85f, 0.25f, 0.2f), new Color(0.12f, 0.6f, 0.6f), new Color(0.95f, 0.55f, 0.15f),
            new Color(0.95f, 0.8f, 0.2f), new Color(0.3f, 0.65f, 0.3f), new Color(0.45f, 0.35f, 0.7f),
        };

        public static ModelPalette AmbientPalette(int seed, AmbientStructure type)
        {
            uint h = (uint)(seed * 2654435761u);
            Color wall = WallColors[h % WallColors.Length];
            Color roof = RoofColors[(h >> 8) % RoofColors.Length];
            Color accent = AccentColors[(h >> 16) % AccentColors.Length];
            if (type == AmbientStructure.OfficeTower) wall = Color.Lerp(wall, new Color(0.85f, 0.87f, 0.9f), 0.7f);
            if (type == AmbientStructure.Warehouse) wall = Color.Lerp(wall, new Color(0.7f, 0.72f, 0.74f), 0.6f);
            var p = ModelPalette.Create(wall, roof, accent);
            if (type == AmbientStructure.Park) p.Ground = new Color(0.82f, 0.76f, 0.62f);
            return p;
        }

        /// <summary>Cor do piso do terreno conforme zoneamento e situação.</summary>
        public static Color LotGround(Lot lot, bool ownedByPlayer)
        {
            if (ownedByPlayer) return PlayerOwned;
            if (lot.District == District.Park || lot.Ambient == AmbientStructure.House) return Grass;
            if (lot.IsAmbient)
            {
                switch (lot.District)
                {
                    case District.Industrial: return new Color(0.64f, 0.63f, 0.6f);
                    case District.Residential: return new Color(0.55f, 0.7f, 0.43f);
                    default: return new Color(0.7f, 0.7f, 0.71f);
                }
            }
            // À venda: tom de terra com leve variação por distrito.
            switch (lot.District)
            {
                case District.Residential: return new Color(0.74f, 0.74f, 0.55f);
                case District.Industrial: return new Color(0.7f, 0.66f, 0.58f);
                case District.Downtown: return new Color(0.86f, 0.8f, 0.66f);
                default: return new Color(0.82f, 0.76f, 0.6f);
            }
        }
    }
}
