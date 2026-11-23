using System.Linq;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class GameSessionTests
    {
        private static int P(GameSession s) => s.Player.Id;

        [Test]
        public void NewGame_PlayerStartsWithCapitalAndOneCommercialLot()
        {
            var s = TestData.NewSession(100_000);
            Assert.AreEqual(Money.FromUnits(100_000), s.Player.Cash);
            var owned = s.City.Lots.Where(l => l.OwnerId == P(s)).ToList();
            Assert.AreEqual(1, owned.Count);
            Assert.AreEqual(District.Commercial, owned[0].District);
            Assert.IsFalse(owned[0].HasBuilding);
        }

        [Test]
        public void BuyLot_DebitsPricePlusTax_AndTransfersOwnership()
        {
            var s = TestData.NewSession();
            var lot = TestData.FirstLot(s, l => l.IsForSale);
            var before = s.Player.Cash;
            var expected = s.LandMarket.PurchaseCost(lot);

            int events = 0;
            s.Events.Subscribe<LotOwnershipChanged>(e => { if (e.LotId == lot.Id) events++; });
            var r = s.BuyLot(P(s), lot.Id);

            Assert.IsTrue(r.Success, r.ToString());
            Assert.AreEqual(expected, r.Amount);
            Assert.AreEqual(before - expected, s.Player.Cash);
            Assert.AreEqual(P(s), lot.OwnerId);
            Assert.AreEqual(1, events);
        }

        [Test]
        public void BuyLot_FailsWithoutFunds_AndChangesNothing()
        {
            var s = TestData.NewSession(10);
            var lot = TestData.FirstLot(s, l => l.IsForSale);
            var r = s.BuyLot(P(s), lot.Id);
            Assert.AreEqual(CommandError.InsufficientFunds, r.Error);
            Assert.AreEqual(Lot.NoOwner, lot.OwnerId);
            Assert.AreEqual(Money.FromUnits(10), s.Player.Cash);
        }

        [Test]
        public void BuyLot_RejectsAmbientParkAndOwnedLots()
        {
            var s = TestData.NewSession();
            var ambient = TestData.FirstLot(s, l => l.IsAmbient && l.District != District.Park);
            Assert.AreEqual(CommandError.LotNotForSale, s.BuyLot(P(s), ambient.Id).Error);
            var owned = TestData.OwnedLot(s);
            Assert.AreEqual(CommandError.LotAlreadyOwned, s.BuyLot(P(s), owned.Id).Error);
            Assert.AreEqual(CommandError.UnknownLot, s.BuyLot(P(s), 99999).Error);
            Assert.AreEqual(CommandError.UnknownCompany, s.BuyLot(1234, owned.Id).Error);
        }

        [Test]
        public void BuyThenSell_AlwaysLosesMoney_NoArbitrage()
        {
            var s = TestData.NewSession(10_000_000);
            foreach (var lot in s.City.Lots.Where(l => l.IsForSale).ToList())
            {
                var before = s.Player.Cash;
                Assert.IsTrue(s.BuyLot(P(s), lot.Id).Success);
                Assert.IsTrue(s.SellLot(P(s), lot.Id).Success);
                Assert.Less(s.Player.Cash.Cents, before.Cents, "Ciclo compra/venda gerou lucro no terreno #" + lot.Id);
            }
        }

        [Test]
        public void SellLot_RequiresOwnershipAndNoBuilding()
        {
            var s = TestData.NewSession();
            var owned = TestData.OwnedLot(s);
            var other = TestData.FirstLot(s, l => l.IsForSale);
            Assert.AreEqual(CommandError.LotNotOwned, s.SellLot(P(s), other.Id).Error);

            Assert.IsTrue(s.Construct(P(s), owned.Id, TestData.Shop).Success);
            Assert.AreEqual(CommandError.LotHasBuilding, s.SellLot(P(s), owned.Id).Error);
        }

        [Test]
        public void Construct_ValidatesRules()
        {
            var s = TestData.NewSession();
            var owned = TestData.OwnedLot(s);
            var notOwned = TestData.FirstLot(s, l => l.IsForSale);

            Assert.AreEqual(CommandError.UnknownDefinition, s.CanConstruct(P(s), owned.Id, "nope").Error);
            Assert.AreEqual(CommandError.LotNotOwned, s.CanConstruct(P(s), notOwned.Id, TestData.Shop).Error);
            Assert.AreEqual(CommandError.DistrictNotAllowed, s.CanConstruct(P(s), owned.Id, TestData.Factory).Error);
            Assert.IsTrue(s.CanConstruct(P(s), owned.Id, TestData.Shop).Success);
        }

        [Test]
        public void Construct_FailsWithoutFunds()
        {
            var s = TestData.NewSession(1_000);
            var owned = TestData.OwnedLot(s);
            var r = s.Construct(P(s), owned.Id, TestData.Shop);
            Assert.AreEqual(CommandError.InsufficientFunds, r.Error);
            Assert.IsFalse(owned.HasBuilding);
            Assert.AreEqual(0, s.BuildingCount);
        }

        [Test]
        public void Construct_TakesConfiguredHours_ThenBecomesOperational()
        {
            var s = TestData.NewSession();
            var lot = TestData.OwnedLot(s);
            var cashBefore = s.Player.Cash;
            var r = s.Construct(P(s), lot.Id, TestData.Shop);
            Assert.IsTrue(r.Success);
            Assert.AreEqual(cashBefore - Money.FromUnits(20_000), s.Player.Cash);

            var b = s.GetBuilding(r.EntityId);
            Assert.AreEqual(BuildingState.UnderConstruction, b.State);
            Assert.AreEqual(CommandError.LotOccupied, s.CanConstruct(P(s), lot.Id, TestData.Shop).Error);

            s.StepHours(23);
            Assert.AreEqual(BuildingState.UnderConstruction, b.State);
            Assert.That(b.WorkProgress01, Is.EqualTo(23f / 24f).Within(1e-5));
            s.StepHours(1);
            Assert.AreEqual(BuildingState.Operational, b.State);
            Assert.AreEqual(1, b.Level);
        }

        [Test]
        public void IndustrialLots_AcceptFactories()
        {
            var s = TestData.NewSession(1_000_000);
            var ind = TestData.FirstLot(s, l => l.IsForSale && l.District == District.Industrial);
            Assert.IsNotNull(ind);
            Assert.IsTrue(s.BuyLot(P(s), ind.Id).Success);
            Assert.IsTrue(s.Construct(P(s), ind.Id, TestData.Factory).Success);
        }

        [Test]
        public void Construct_RejectsLotsSmallerThanFootprint()
        {
            var defs = TestData.Definitions();
            defs.Add(new BuildingDefinition("big_store", "Hipermercado", "", BuildingCategory.Retail,
                DistrictMask.Commercial, 18, Money.FromUnits(10), 1, Money.Zero, 1, 1, 1, 0, null));
            var s = new GameSession(TestData.Config(), defs);
            Assert.AreEqual(CommandError.LotTooSmall, s.CanConstruct(P(s), TestData.OwnedLot(s).Id, "big_store").Error);
        }

        [Test]
        public void Upgrade_CostsMore_TakesTime_AndRaisesLevel()
        {
            var s = TestData.NewSession(1_000_000);
            var lot = TestData.OwnedLot(s);
            var id = s.Construct(P(s), lot.Id, TestData.Shop).EntityId;
            var b = s.GetBuilding(id);

            Assert.AreEqual(CommandError.BuildingBusy, s.CanUpgrade(P(s), id).Error);
            s.StepHours(24);

            var cost = b.Definition.UpgradeCost(1);
            var before = s.Player.Cash;
            var r = s.Upgrade(P(s), id);
            Assert.IsTrue(r.Success);
            Assert.AreEqual(before - cost, s.Player.Cash);
            Assert.AreEqual(BuildingState.Upgrading, b.State);
            Assert.AreEqual(1, b.Level);

            s.StepHours(b.WorkTotalHours);
            Assert.AreEqual(BuildingState.Operational, b.State);
            Assert.AreEqual(2, b.Level);

            s.StepHours(b.Definition.UpgradeHours(2) + 1);
            Assert.IsTrue(s.Upgrade(P(s), id).Success);
            s.StepHours(b.WorkTotalHours);
            Assert.AreEqual(3, b.Level);
            Assert.AreEqual(CommandError.MaxLevelReached, s.CanUpgrade(P(s), id).Error);
        }

        [Test]
        public void UpgradeCost_GrowsWithLevel()
        {
            var def = TestData.Definitions()[0];
            Assert.Less(def.UpgradeCost(1).Cents, def.UpgradeCost(2).Cents);
            Assert.Less(def.MaintenanceAtLevel(1).Cents, def.MaintenanceAtLevel(2).Cents);
        }

        [Test]
        public void Demolish_RefundsOnlyAFraction_AndFreesLot()
        {
            var s = TestData.NewSession();
            var lot = TestData.OwnedLot(s);
            var before = s.Player.Cash;
            var id = s.Construct(P(s), lot.Id, TestData.Shop).EntityId;
            var r = s.Demolish(P(s), id);
            Assert.IsTrue(r.Success);
            Assert.AreEqual(Money.FromUnits(5_000), r.Amount); // 25% de 20.000
            Assert.Less(s.Player.Cash.Cents, before.Cents);
            Assert.IsFalse(lot.HasBuilding);
            Assert.IsNull(s.GetBuilding(id));
            Assert.IsTrue(s.CanConstruct(P(s), lot.Id, TestData.Shop).Success);
        }

        [Test]
        public void DailyCosts_ChargeMaintenanceAndPropertyTax()
        {
            var s = TestData.NewSession();
            var lot = TestData.OwnedLot(s);
            var id = s.Construct(P(s), lot.Id, TestData.Shop).EntityId;

            // Avança até a conclusão (24h); a partida começa às 08:00.
            s.StepHours(24);
            Assert.AreEqual(BuildingState.Operational, s.GetBuilding(id).State);

            var expectedDaily = Money.FromUnits(100) + s.LandMarket.DailyPropertyTax(lot);
            Assert.AreEqual(expectedDaily, s.DailyUpkeep(P(s)));

            var before = s.Player.Cash;
            s.StepHours(24); // cruza exatamente uma meia-noite
            Assert.AreEqual(before - expectedDaily, s.Player.Cash);
        }

        [Test]
        public void ConstructionSite_PaysNoMaintenance()
        {
            var s = TestData.NewSession();
            var ind = TestData.FirstLot(s, l => l.IsForSale && l.District == District.Industrial);
            s.BuyLot(P(s), ind.Id);
            s.Construct(P(s), ind.Id, TestData.Factory); // 72h de obra
            var before = s.Player.Cash;
            // Valores de terreno só mudam na virada do dia, depois das cobranças: calcula antes.
            var taxOnly = Money.Zero;
            foreach (var l in s.City.Lots) if (l.OwnerId == P(s)) taxOnly += s.LandMarket.DailyPropertyTax(l);
            s.StepHours(24);
            Assert.AreEqual(before - taxOnly, s.Player.Cash);
        }

        [Test]
        public void Cash_AlwaysEqualsSumOfLedger()
        {
            var s = TestData.NewSession(2_000_000);
            var p = P(s);
            foreach (var lot in s.City.Lots.Where(l => l.IsForSale).Take(10).ToList()) s.BuyLot(p, lot.Id);
            foreach (var lot in s.City.Lots.Where(l => l.OwnerId == p).ToList())
                s.Construct(p, lot.Id, lot.District == District.Industrial ? TestData.Factory : TestData.Shop);
            s.StepHours(24 * 5);
            foreach (var b in s.Buildings.ToList()) s.Upgrade(p, b.Id);
            s.StepHours(24 * 3);
            var first = s.Buildings.First();
            s.Demolish(p, first.Id);
            s.SellLot(p, first.LotId);

            Money sum = Money.Zero;
            foreach (TransactionCategory c in System.Enum.GetValues(typeof(TransactionCategory)))
                sum += s.Player.Ledger.TotalFor(c);
            Assert.AreEqual(s.Player.Cash, sum);
        }

        [Test]
        public void Advance_UsesRealTimeAndSpeed()
        {
            var s = TestData.NewSession();
            long start = s.Clock.TotalTicks;
            s.Advance(s.Config.SecondsPerTick * 4);
            Assert.AreEqual(start + 4, s.Clock.TotalTicks);
            s.Clock.Speed = GameSpeed.Paused;
            s.Advance(100);
            Assert.AreEqual(start + 4, s.Clock.TotalTicks);
        }

        [Test]
        public void Catalog_RejectsDuplicatesAndInvalidDefinitions()
        {
            var defs = TestData.Definitions();
            defs.Add(defs[0]);
            Assert.Throws<System.ArgumentException>(() => new BuildingCatalog(defs));
            Assert.Throws<System.ArgumentException>(() => new BuildingDefinition("x", "X", "", BuildingCategory.Retail,
                DistrictMask.None, 9, Money.FromUnits(1), 1, Money.Zero, 1, 1, 1, 0, null));
        }

        [Test]
        public void LandValue_IsHigherDowntownThanResidential()
        {
            var s = TestData.NewSession();
            var market = s.LandMarket;
            var downtown = s.City.Lots.Where(l => l.District == District.Downtown).Max(l => market.MarketValue(l).Cents / l.Rect.Area);
            var residential = s.City.Lots.Where(l => l.District == District.Residential).Max(l => market.MarketValue(l).Cents / l.Rect.Area);
            Assert.Greater(downtown, residential);
        }
    }
}
