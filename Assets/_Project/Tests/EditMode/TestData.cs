using System.Collections.Generic;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Tests
{
    /// <summary>Fábrica de dados de teste (independente dos assets da Unity).</summary>
    internal static class TestData
    {
        public const string Shop = "test_shop";
        public const string Factory = "test_factory";

        public static List<BuildingDefinition> Definitions()
        {
            return new List<BuildingDefinition>
            {
                new BuildingDefinition(Shop, "Loja Teste", "", BuildingCategory.Retail,
                    DistrictMask.Commercial | DistrictMask.Downtown | DistrictMask.Residential, 9,
                    Money.FromUnits(20_000), 24, Money.FromUnits(100), 3, 0.6, 0.5, 0.5, "shop"),
                new BuildingDefinition(Factory, "Fábrica Teste", "", BuildingCategory.Industry,
                    DistrictMask.Industrial, 18,
                    Money.FromUnits(90_000), 72, Money.FromUnits(400), 3, 0.6, 0.5, 0.5, "factory"),
            };
        }

        public static GameConfig Config(long startingCash = 250_000)
        {
            return new GameConfig { StartingCashUnits = startingCash };
        }

        public static GameSession NewSession(long startingCash = 250_000)
        {
            return new GameSession(Config(startingCash), Definitions());
        }

        public static Lot FirstLot(GameSession s, System.Func<Lot, bool> predicate)
        {
            foreach (var lot in s.City.Lots) if (predicate(lot)) return lot;
            return null;
        }

        public static Lot OwnedLot(GameSession s) => FirstLot(s, l => l.OwnerId == s.Player.Id);
    }
}
