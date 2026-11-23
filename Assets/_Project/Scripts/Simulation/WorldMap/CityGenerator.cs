using System;
using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>
    /// Gera uma cidade determinística em grade: ruas a cada quarteirão, zoneamento por anéis
    /// (centro → comercial → residencial) e um setor industrial a leste.
    /// </summary>
    public static class CityGenerator
    {
        public static CityMap Generate(int cityId, CityLayoutConfig cfg)
        {
            if (cfg == null) throw new ArgumentNullException(nameof(cfg));
            cfg.Validate();

            var rng = new DeterministicRandom(cfg.Seed);
            var map = new CityMap(cityId, cfg.CityName, cfg.Width, cfg.Height);
            int stride = cfg.BlockSize + 1;

            for (int y = 0; y < map.Height; y++)
            for (int x = 0; x < map.Width; x++)
                if (x % stride == 0 || y % stride == 0) map.SetCell(new GridCoord(x, y), CellType.Road);

            double cx = (cfg.BlocksX - 1) * 0.5;
            double cy = (cfg.BlocksY - 1) * 0.5;
            double maxDist = Math.Sqrt(cx * cx + cy * cy);

            for (int by = 0; by < cfg.BlocksY; by++)
            for (int bx = 0; bx < cfg.BlocksX; bx++)
            {
                double dist01 = maxDist > 0 ? Math.Sqrt((bx - cx) * (bx - cx) + (by - cy) * (by - cy)) / maxDist : 0;
                District district = ClassifyBlock(bx, by, cfg, dist01);
                if (district != District.Downtown && district != District.Industrial && rng.Chance(cfg.ParkChance))
                    district = District.Park;

                int ox = bx * stride + 1;
                int oy = by * stride + 1;
                int half = cfg.BlockSize / 2;

                if (district == District.Park)
                {
                    var park = map.AddLot(new GridRect(ox, oy, cfg.BlockSize, cfg.BlockSize), district, dist01);
                    park.Ambient = AmbientStructure.Park;
                    continue;
                }

                if (district == District.Industrial)
                {
                    // Lotes industriais maiores: 2 por quarteirão.
                    AddLot(map, rng, cfg, new GridRect(ox, oy, cfg.BlockSize, half), district, dist01);
                    AddLot(map, rng, cfg, new GridRect(ox, oy + half, cfg.BlockSize, half), district, dist01);
                }
                else
                {
                    for (int ly = 0; ly < 2; ly++)
                    for (int lx = 0; lx < 2; lx++)
                        AddLot(map, rng, cfg, new GridRect(ox + lx * half, oy + ly * half, half, half), district, dist01);
                }
            }

            return map;
        }

        private static District ClassifyBlock(int bx, int by, CityLayoutConfig cfg, double dist01)
        {
            if (bx >= cfg.BlocksX - 2 && dist01 > 0.3) return District.Industrial;
            if (dist01 <= 0.2) return District.Downtown;
            if (dist01 <= 0.55) return District.Commercial;
            return District.Residential;
        }

        private static void AddLot(CityMap map, DeterministicRandom rng, CityLayoutConfig cfg, GridRect rect, District district, double dist01)
        {
            var lot = map.AddLot(rect, district, dist01);
            if (!rng.Chance(cfg.AmbientDensity[(int)district])) return;

            AmbientRules.Pick(district, rng, out var type, out int floors);
            lot.Ambient = type;
            lot.AmbientFloors = floors;
        }
    }
}
