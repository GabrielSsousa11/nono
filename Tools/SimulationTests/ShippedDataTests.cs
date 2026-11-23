using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using EmpireTycoon.Tests.Tooling;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    /// <summary>
    /// Valida os dados reais do jogo (assets .asset da Unity) com a simulação real, e gera um
    /// relatório de balanceamento. Roda apenas fora da Unity (dotnet test).
    /// </summary>
    public class ShippedDataTests
    {
        private static string DataPath(string rel) => Path.Combine(UnityAssetReader.RepoRoot, rel);

        public static List<BuildingDefinition> LoadBuildings()
        {
            var db = UnityAssetReader.ReadMonoBehaviour(DataPath("Assets/_Project/Resources/GameDatabase.asset"));
            var byGuid = new Dictionary<string, string>();
            foreach (var asset in Directory.GetFiles(DataPath("Assets/_Project/Data/Buildings"), "*.asset"))
            {
                var meta = File.ReadAllLines(asset + ".meta").First(l => l.StartsWith("guid:")).Substring(5).Trim();
                byGuid[meta] = asset;
            }

            var list = new List<BuildingDefinition>();
            foreach (var reference in db["buildings"].List)
            {
                string guid = reference.Scalar.Split("guid:")[1].Split(',')[0].Trim();
                Assert.IsTrue(byGuid.ContainsKey(guid), "GameDatabase referencia asset inexistente: " + guid);
                var n = UnityAssetReader.ReadMonoBehaviour(byGuid[guid]);
                list.Add(new BuildingDefinition(
                    n["id"].Str, n["displayName"].Str, n["description"].Str, (BuildingCategory)n["category"].Int,
                    (DistrictMask)n["allowedDistricts"].Int, n["minLotArea"].Int, Money.FromUnits(n["constructionCost"].Long),
                    n["constructionHours"].Int, Money.FromUnits(n["dailyMaintenance"].Long), n["maxLevel"].Int,
                    (float)n["upgradeCostFactor"].Double, (float)n["upgradeTimeFactor"].Double,
                    (float)n["maintenanceGrowthPerLevel"].Double, n["visualKey"].Str));
            }
            return list;
        }

        public static GameConfig LoadConfig()
        {
            var db = UnityAssetReader.ReadMonoBehaviour(DataPath("Assets/_Project/Resources/GameDatabase.asset"));
            var c = db["newGameConfig"];
            var city = c["City"];
            var eco = c["Economy"];
            return new GameConfig
            {
                PlayerCompanyName = c["PlayerCompanyName"].Str,
                StartingCashUnits = c["StartingCashUnits"].Long,
                SecondsPerTick = c["SecondsPerTick"].Double,
                MaxTicksPerFrame = c["MaxTicksPerFrame"].Int,
                StartHour = c["StartHour"].Int,
                City = new CityLayoutConfig
                {
                    CityName = city["CityName"].Str,
                    Seed = city["Seed"].ULong,
                    BlocksX = city["BlocksX"].Int,
                    BlocksY = city["BlocksY"].Int,
                    BlockSize = city["BlockSize"].Int,
                    AmbientDensity = city["AmbientDensity"].List.Select(x => x.Double).ToArray(),
                    ParkChance = city["ParkChance"].Double,
                },
                Economy = new EconomyConfig
                {
                    LandPricePerCell = eco["LandPricePerCell"].List.Select(x => x.Long).ToArray(),
                    CentralityBonus = eco["CentralityBonus"].Double,
                    LandSaleRatio = eco["LandSaleRatio"].Double,
                    TransferTaxRate = eco["TransferTaxRate"].Double,
                    PropertyTaxRatePerYear = eco["PropertyTaxRatePerYear"].Double,
                    DemolitionRefundRatio = eco["DemolitionRefundRatio"].Double,
                    NeighborhoodRadiusCells = eco["NeighborhoodRadiusCells"].Int,
                    DevelopmentBonus = eco["DevelopmentBonus"].Double,
                    ParkBonus = eco["ParkBonus"].Double,
                    MaxNeighborhoodBonus = eco["MaxNeighborhoodBonus"].Double,
                },
                Growth = new CityGrowthConfig
                {
                    Enabled = c["Growth"]["Enabled"].Int != 0,
                    DailyDevelopmentChance = c["Growth"]["DailyDevelopmentChance"].Double,
                    DevelopmentHours = c["Growth"]["DevelopmentHours"].Int,
                    MinVacantFraction = c["Growth"]["MinVacantFraction"].Double,
                },
            };
        }

        [Test]
        public void ShippedConfig_IsValid_AndSessionStarts()
        {
            var cfg = LoadConfig();
            Assert.DoesNotThrow(cfg.Validate);
            var s = new GameSession(cfg, LoadBuildings());
            Assert.AreEqual(5, s.Catalog.All.Count);
            Assert.AreEqual(1, s.City.Lots.Count(l => l.OwnerId == s.Player.Id));
        }

        [Test]
        public void EveryShippedBuilding_HasAValidLotTypeInTheCity()
        {
            var s = new GameSession(LoadConfig(), LoadBuildings());
            foreach (var def in s.Catalog.All)
            {
                bool any = s.City.Lots.Any(l => l.IsForSale && def.AllowedDistricts.Allows(l.District) && l.Rect.Area >= def.MinLotArea);
                Assert.IsTrue(any, "Nenhum terreno disponível aceita '" + def.Id + "'.");
            }
        }

        [Test]
        public void StarterLot_AcceptsAnAffordableFirstBusiness()
        {
            var s = new GameSession(LoadConfig(), LoadBuildings());
            var starter = s.City.Lots.First(l => l.OwnerId == s.Player.Id);
            var buildable = s.Catalog.All.Where(d => s.CanConstruct(s.Player.Id, starter.Id, d.Id).Success).ToList();
            Assert.IsNotEmpty(buildable, "O jogador não consegue construir nada no terreno inicial.");
        }

        [Test]
        public void ShippedData_SimulatesOneYearWithoutErrors()
        {
            var s = new GameSession(LoadConfig(), LoadBuildings());
            int p = s.Player.Id;
            var starter = s.City.Lots.First(l => l.OwnerId == p);
            Assert.IsTrue(s.Construct(p, starter.Id, "grocery").Success);
            var ind = s.City.Lots.First(l => l.IsForSale && l.District == District.Industrial);
            Assert.IsTrue(s.BuyLot(p, ind.Id).Success);
            Assert.IsTrue(s.Construct(p, ind.Id, "warehouse").Success);
            s.StepHours(24 * 360);

            Money sum = Money.Zero;
            foreach (TransactionCategory c in Enum.GetValues(typeof(TransactionCategory))) sum += s.Player.Ledger.TotalFor(c);
            Assert.AreEqual(s.Player.Cash, sum);
            Assert.AreEqual(BuildingState.Operational, s.Buildings.First().State);
        }

        /// <summary>Relatório de balanceamento (aparece na saída do teste com --logger "console;verbosity=detailed").</summary>
        [Test]
        public void BalanceReport()
        {
            var cfg = LoadConfig();
            var s = new GameSession(cfg, LoadBuildings());
            var sb = new StringBuilder();
            sb.AppendLine("=== RELATÓRIO DE BALANCEAMENTO — " + cfg.City.CityName + " ===");
            sb.AppendLine("Capital inicial: " + cfg.StartingCash);
            sb.AppendLine("Terrenos: " + s.City.Lots.Count + " (à venda: " + s.City.Lots.Count(l => l.IsForSale) + ")");
            sb.AppendLine("População: " + s.Stats.Residents + "  Empregos: " + s.Stats.Jobs);
            var later = new GameSession(cfg, LoadBuildings());
            later.StepHours(24 * 360);
            sb.AppendLine("Após 1 ano: à venda " + later.City.Lots.Count(l => l.IsForSale) + ", população " + later.Stats.Residents +
                          ", empregos " + later.Stats.Jobs + ", valorização média " + later.City.Lots.Average(l => l.NeighborhoodBonus).ToString("P1"));
            foreach (District d in Enum.GetValues(typeof(District)))
            {
                var lots = s.City.Lots.Where(l => l.District == d && l.IsForSale).ToList();
                if (lots.Count == 0) continue;
                var prices = lots.Select(l => s.LandMarket.PurchaseCost(l)).OrderBy(m => m.Cents).ToList();
                sb.AppendLine($"  {d,-12} {lots.Count,3} lotes  compra {prices.First()} .. {prices.Last()}");
            }
            sb.AppendLine("Edifícios:");
            foreach (var def in s.Catalog.All)
            {
                var levels = string.Join(" | ", Enumerable.Range(1, def.MaxLevel).Select(l =>
                    "N" + l + ": manut " + Money.FormatCompact(def.MaintenanceAtLevel(l)) + (l < def.MaxLevel ? ", melhoria " + Money.FormatCompact(def.UpgradeCost(l)) : "")));
                long runwayDays = (cfg.StartingCash - def.ConstructionCost).Cents / Math.Max(1, def.DailyMaintenance.Cents);
                sb.AppendLine($"  {def.DisplayName,-24} custo {def.ConstructionCost,-16} obra {def.ConstructionHours,4}h  fôlego ~{runwayDays} dias  [{levels}]");
            }
            TestContext.Progress.WriteLine(sb.ToString());
            Assert.Pass();
        }
    }
}
