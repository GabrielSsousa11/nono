using System.Linq;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.WorldMap;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class CityGeneratorTests
    {
        [Test]
        public void SameSeed_ProducesIdenticalCity()
        {
            var a = CityGenerator.Generate(0, new CityLayoutConfig());
            var b = CityGenerator.Generate(0, new CityLayoutConfig());
            Assert.AreEqual(a.Lots.Count, b.Lots.Count);
            for (int i = 0; i < a.Lots.Count; i++)
            {
                Assert.AreEqual(a.Lots[i].Rect, b.Lots[i].Rect);
                Assert.AreEqual(a.Lots[i].District, b.Lots[i].District);
                Assert.AreEqual(a.Lots[i].Ambient, b.Lots[i].Ambient);
            }
        }

        [Test]
        public void DifferentSeed_ChangesCity()
        {
            var a = CityGenerator.Generate(0, new CityLayoutConfig { Seed = 1 });
            var b = CityGenerator.Generate(0, new CityLayoutConfig { Seed = 2 });
            bool anyDifference = a.Lots.Count != b.Lots.Count ||
                                 a.Lots.Zip(b.Lots, (x, y) => x.Ambient != y.Ambient || x.District != y.District).Any(d => d);
            Assert.IsTrue(anyDifference);
        }

        [Test]
        public void City_HasAllZonesAndPurchasableLots()
        {
            var map = CityGenerator.Generate(0, new CityLayoutConfig());
            Assert.That(map.Lots.Any(l => l.District == District.Downtown));
            Assert.That(map.Lots.Any(l => l.District == District.Commercial));
            Assert.That(map.Lots.Any(l => l.District == District.Residential));
            Assert.That(map.Lots.Any(l => l.District == District.Industrial));
            Assert.That(map.Lots.Count(l => l.IsForSale), Is.GreaterThan(20));
            Assert.That(map.Lots.Any(l => l.IsAmbient));
        }

        [Test]
        public void EveryLot_IsAdjacentToARoad()
        {
            var map = CityGenerator.Generate(0, new CityLayoutConfig());
            foreach (var lot in map.Lots)
            {
                bool touchesRoad = false;
                var r = lot.Rect;
                for (int x = r.X; x < r.MaxX && !touchesRoad; x++)
                    touchesRoad |= map.GetCell(new GridCoord(x, r.Y - 1)) == CellType.Road || map.GetCell(new GridCoord(x, r.MaxY)) == CellType.Road;
                for (int y = r.Y; y < r.MaxY && !touchesRoad; y++)
                    touchesRoad |= map.GetCell(new GridCoord(r.X - 1, y)) == CellType.Road || map.GetCell(new GridCoord(r.MaxX, y)) == CellType.Road;
                Assert.IsTrue(touchesRoad, "Terreno sem acesso à rua: " + lot.Rect);
            }
        }

        [Test]
        public void CellLookup_MatchesLotRects()
        {
            var map = CityGenerator.Generate(0, new CityLayoutConfig());
            foreach (var lot in map.Lots)
            {
                Assert.AreSame(lot, map.GetLotAt(new GridCoord(lot.Rect.X, lot.Rect.Y)));
                Assert.AreSame(lot, map.GetLotAt(new GridCoord(lot.Rect.MaxX - 1, lot.Rect.MaxY - 1)));
            }
            Assert.IsNull(map.GetLotAt(new GridCoord(0, 0)), "(0,0) é rua");
            Assert.IsNull(map.GetLotAt(new GridCoord(-1, 5)));
        }

        [Test]
        public void InvalidConfig_IsRejected()
        {
            Assert.Throws<System.InvalidOperationException>(() => CityGenerator.Generate(0, new CityLayoutConfig { BlockSize = 5 }));
            Assert.Throws<System.InvalidOperationException>(() => CityGenerator.Generate(0, new CityLayoutConfig { BlocksX = 1 }));
        }
    }
}
