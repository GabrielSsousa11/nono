using System.Linq;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class CityGrowthTests
    {
        [Test]
        public void City_DevelopsOverTime_ButKeepsLotsForSaleInEveryZone()
        {
            var s = TestData.NewSession();
            int vacantBefore = s.City.Lots.Count(l => l.IsForSale);
            int started = 0, completed = 0;
            s.Events.Subscribe<LotDevelopmentChanged>(e => { if (e.Completed) completed++; else started++; });

            s.StepHours(24 * 360);

            Assert.Greater(started, 10, "A cidade deveria crescer ao longo de um ano.");
            Assert.That(completed, Is.InRange(started - 1, started));
            Assert.Less(s.City.Lots.Count(l => l.IsForSale), vacantBefore);

            var cfg = s.Config.Growth;
            foreach (District d in new[] { District.Residential, District.Commercial, District.Industrial, District.Downtown })
            {
                int total = s.City.Lots.Count(l => l.District == d);
                int vacant = s.City.Lots.Count(l => l.District == d && l.IsForSale);
                int initialVacant = TestData.NewSession().City.Lots.Count(l => l.District == d && l.IsForSale);
                Assert.That(vacant, Is.GreaterThanOrEqualTo(System.Math.Min(initialVacant, (int)System.Math.Ceiling(total * cfg.MinVacantFraction))),
                    "Zona " + d + " ficou sem terrenos à venda.");
            }
        }

        [Test]
        public void Growth_NeverTouchesPlayerLots()
        {
            var s = TestData.NewSession(5_000_000);
            foreach (var lot in s.City.Lots.Where(l => l.IsForSale).Take(30).ToList()) s.BuyLot(s.Player.Id, lot.Id);
            var mine = s.City.Lots.Where(l => l.OwnerId == s.Player.Id).Select(l => l.Id).ToList();
            s.StepHours(24 * 200);
            foreach (int id in mine)
            {
                Assert.AreEqual(s.Player.Id, s.City.GetLot(id).OwnerId);
                Assert.IsFalse(s.City.GetLot(id).IsAmbient);
            }
        }

        [Test]
        public void Growth_IsDeterministic()
        {
            var a = TestData.NewSession();
            var b = TestData.NewSession();
            a.StepHours(24 * 90);
            b.StepHours(24 * 90);
            for (int i = 0; i < a.City.Lots.Count; i++)
            {
                Assert.AreEqual(a.City.Lots[i].Ambient, b.City.Lots[i].Ambient);
                Assert.AreEqual(a.City.Lots[i].NeighborhoodBonus, b.City.Lots[i].NeighborhoodBonus);
            }
        }

        [Test]
        public void Growth_CanBeDisabled()
        {
            var cfg = TestData.Config();
            cfg.Growth.Enabled = false;
            var s = new GameSession(cfg, TestData.Definitions());
            int before = s.City.Lots.Count(l => l.IsForSale);
            s.StepHours(24 * 60);
            Assert.AreEqual(before, s.City.Lots.Count(l => l.IsForSale));
        }

        [Test]
        public void Stats_CountResidentsAndJobs()
        {
            var s = TestData.NewSession();
            Assert.Greater(s.Stats.Residents, 0);
            Assert.Greater(s.Stats.Jobs, 0);
            Assert.AreEqual(s.City.Lots.Count(l => l.District != District.Park), s.Stats.TotalLots);
            int residents = s.Stats.Residents;
            s.StepHours(24 * 120);
            Assert.GreaterOrEqual(s.Stats.Residents + s.Stats.Jobs, residents);
        }

        [Test]
        public void NeighborhoodBonus_IsBoundedAndRaisesValue()
        {
            var s = TestData.NewSession();
            s.StepHours(24 * 180);
            double max = s.Config.Economy.MaxNeighborhoodBonus;
            Assert.That(s.City.Lots.All(l => l.NeighborhoodBonus >= 0 && l.NeighborhoodBonus <= max + 1e-12));
            Assert.That(s.City.Lots.Any(l => l.NeighborhoodBonus > 0.01));
        }

        [Test]
        public void Appreciation_NeverAllowsProfitFromResale()
        {
            // Compra antes da valorização, espera a cidade crescer, revende: ainda perde dinheiro.
            var s = TestData.NewSession(10_000_000);
            var bought = s.City.Lots.Where(l => l.IsForSale).Take(25).ToList();
            var paid = bought.ToDictionary(l => l.Id, l => s.LandMarket.PurchaseCost(l));
            foreach (var lot in bought) Assert.IsTrue(s.BuyLot(s.Player.Id, lot.Id).Success);
            s.StepHours(24 * 365);
            foreach (var lot in bought)
                Assert.Less(s.LandMarket.SaleValue(lot).Cents, paid[lot.Id].Cents, "Revenda lucrativa no terreno #" + lot.Id);
        }

        [Test]
        public void Config_RejectsExploitableResaleParameters()
        {
            var eco = new EconomyConfig { LandSaleRatio = 0.95, MaxNeighborhoodBonus = 0.2, TransferTaxRate = 0.03 };
            Assert.Throws<System.InvalidOperationException>(eco.Validate);
        }

        [Test]
        public void PricesOnlyChangeAtMidnight()
        {
            var s = TestData.NewSession();
            s.StepHours(24 * 30);
            while (s.Clock.Hour != 1) s.StepTick();
            var values = s.City.Lots.Select(l => s.LandMarket.MarketValue(l)).ToList();
            s.StepHours(22); // até 23:00 do mesmo dia
            CollectionAssert.AreEqual(values, s.City.Lots.Select(l => s.LandMarket.MarketValue(l)).ToList());
        }
    }
}
