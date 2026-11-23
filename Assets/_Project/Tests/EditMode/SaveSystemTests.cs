using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.SaveSystem;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class SaveSystemTests
    {
        private string _dir;

        [SetUp]
        public void SetUp()
        {
            _dir = Path.Combine(Path.GetTempPath(), "empire_tycoon_tests_" + Guid.NewGuid().ToString("N"));
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
        }

        /// <summary>Partida com estado variado: terrenos, obras, melhorias, crescimento da cidade.</summary>
        private static GameSession BusySession(int days = 6)
        {
            var s = TestData.NewSession(2_000_000);
            int p = s.Player.Id;
            s.Construct(p, TestData.OwnedLot(s).Id, TestData.Shop);
            var ind = TestData.FirstLot(s, l => l.IsForSale && l.District == District.Industrial);
            s.BuyLot(p, ind.Id);
            s.Construct(p, ind.Id, TestData.Factory);
            s.StepHours(24 * days);
            s.Upgrade(p, s.GetBuildingOnLot(TestData.OwnedLot(s)).Id);
            s.StepHours(5);
            return s;
        }

        private static byte[] Encode(GameSession s) => new SaveCodec().Encode(s.CreateSnapshot(123456789));

        [Test]
        public void Snapshot_RoundTrip_IsLossless()
        {
            var s = BusySession();
            var codec = new SaveCodec();
            var bytes = Encode(s);
            var restored = GameSession.Restore(TestData.Config(), TestData.Definitions(), codec.Decode(bytes));
            CollectionAssert.AreEqual(bytes, Encode(restored));
            Assert.AreEqual(s.Player.Cash, restored.Player.Cash);
            Assert.AreEqual(s.Clock.TotalTicks, restored.Clock.TotalTicks);
            Assert.AreEqual(s.BuildingCount, restored.BuildingCount);
        }

        [Test]
        public void SaveLoadContinue_MatchesUninterruptedGame()
        {
            var continuous = BusySession();
            continuous.StepHours(24 * 20);

            var paused = BusySession();
            var snapshot = new SaveCodec().Decode(Encode(paused));
            var resumed = GameSession.Restore(TestData.Config(), TestData.Definitions(), snapshot);
            resumed.StepHours(24 * 20);

            CollectionAssert.AreEqual(Encode(continuous), Encode(resumed), "Salvar/carregar alterou o resultado da simulação.");
        }

        [Test]
        public void Restore_KeepsLedgerAndCashConsistent()
        {
            var restored = GameSession.Restore(TestData.Config(), TestData.Definitions(), new SaveCodec().Decode(Encode(BusySession())));
            restored.StepHours(48);
            Money sum = Money.Zero;
            foreach (TransactionCategory c in Enum.GetValues(typeof(TransactionCategory))) sum += restored.Player.Ledger.TotalFor(c);
            Assert.AreEqual(restored.Player.Cash, sum);
        }

        [Test]
        public void Restore_UsesSavedCitySeed_NotCurrentConfig()
        {
            var s = BusySession();
            var snapshot = s.CreateSnapshot(0);
            var otherConfig = TestData.Config();
            otherConfig.City.Seed = 999; // banco de dados mudou depois do save
            var restored = GameSession.Restore(otherConfig, TestData.Definitions(), snapshot);
            Assert.AreEqual(s.CityLayout.Seed, restored.CityLayout.Seed);
            for (int i = 0; i < s.City.Lots.Count; i++) Assert.AreEqual(s.City.Lots[i].Rect, restored.City.Lots[i].Rect);
        }

        [Test]
        public void Restore_RemovedBuildingType_RefundsInvestment()
        {
            var s = BusySession();
            var snapshot = s.CreateSnapshot(0);
            var defs = TestData.Definitions().Where(d => d.Id != TestData.Factory).ToList();
            var factory = snapshot.Buildings.First(b => b.DefinitionId == TestData.Factory);
            var warnings = new List<string>();
            var restored = GameSession.Restore(TestData.Config(), defs, snapshot, warnings);

            Assert.AreEqual(s.Player.Cash + new Money(factory.InvestedCents), restored.Player.Cash);
            Assert.IsFalse(restored.City.GetLot(factory.LotId).HasBuilding);
            Assert.IsNotEmpty(warnings);
        }

        [Test]
        public void Restore_RejectsDifferentMapLayout()
        {
            var snapshot = BusySession().CreateSnapshot(0);
            snapshot.Lots.RemoveAt(0);
            var e = Assert.Throws<SaveException>(() => GameSession.Restore(TestData.Config(), TestData.Definitions(), snapshot));
            Assert.AreEqual(SaveError.IncompatibleData, e.Error);
        }

        [Test]
        public void Decode_DetectsCorruption()
        {
            var bytes = Encode(BusySession());
            var codec = new SaveCodec();

            var flipped = (byte[])bytes.Clone();
            flipped[flipped.Length / 2] ^= 0x40;
            Assert.AreEqual(SaveError.Corrupted, Assert.Throws<SaveException>(() => codec.Decode(flipped)).Error);

            var truncated = bytes.Take(bytes.Length - 10).ToArray();
            Assert.AreEqual(SaveError.Corrupted, Assert.Throws<SaveException>(() => codec.Decode(truncated)).Error);

            Assert.AreEqual(SaveError.Corrupted, Assert.Throws<SaveException>(() => codec.Decode(new byte[] { 1, 2, 3 })).Error);
        }

        [Test]
        public void Decode_RejectsSavesFromNewerGameVersion()
        {
            var newer = new SaveCodec(2, new[] { new SaveMigration(1, _ => { }) });
            var bytes = newer.Encode(BusySession().CreateSnapshot(0));
            var e = Assert.Throws<SaveException>(() => new SaveCodec().Decode(bytes));
            Assert.AreEqual(SaveError.NewerVersion, e.Error);
        }

        [Test]
        public void Decode_MigratesOldFormats()
        {
            var v1Bytes = new SaveCodec().Encode(BusySession().CreateSnapshot(0));
            var v3 = new SaveCodec(3, new[]
            {
                new SaveMigration(1, snap => snap.PlayerCompanyName += " [v2]"),
                new SaveMigration(2, snap => snap.PlayerCompanyName += " [v3]"),
            });
            var migrated = v3.Decode(v1Bytes);
            Assert.AreEqual(3, migrated.FormatVersion);
            StringAssert.EndsWith(" [v2] [v3]", migrated.PlayerCompanyName);

            var missing = new SaveCodec(2, null);
            Assert.AreEqual(SaveError.UnsupportedVersion, Assert.Throws<SaveException>(() => missing.Decode(v1Bytes)).Error);
        }

        [Test]
        public void Storage_SavesAtomically_AndRotatesBackups()
        {
            var storage = new SaveStorage(_dir, backupCount: 2);
            var s = BusySession();
            for (int i = 0; i < 4; i++) { storage.Save("slot1", s.CreateSnapshot(i)); s.StepHours(1); }

            Assert.IsTrue(File.Exists(storage.PathFor("slot1")));
            Assert.IsTrue(File.Exists(storage.BackupPathFor("slot1", 1)));
            Assert.IsTrue(File.Exists(storage.BackupPathFor("slot1", 2)));
            Assert.IsFalse(File.Exists(storage.BackupPathFor("slot1", 3)));
            Assert.IsFalse(File.Exists(storage.PathFor("slot1") + ".tmp"));

            var r = storage.Load("slot1");
            Assert.IsTrue(r.Success);
            Assert.IsFalse(r.FromBackup);
            Assert.AreEqual(3, r.Snapshot.SavedAtUnixMs);
        }

        [Test]
        public void Storage_RecoversFromBackup_WhenMainFileIsCorrupted()
        {
            var storage = new SaveStorage(_dir);
            var s = BusySession();
            storage.Save("auto", s.CreateSnapshot(1));
            storage.Save("auto", s.CreateSnapshot(2));

            var path = storage.PathFor("auto");
            var bytes = File.ReadAllBytes(path);
            File.WriteAllBytes(path, bytes.Take(bytes.Length / 2).ToArray()); // simula queda de energia

            var r = storage.Load("auto");
            Assert.IsTrue(r.Success);
            Assert.IsTrue(r.FromBackup);
            Assert.AreEqual(1, r.Snapshot.SavedAtUnixMs);
            Assert.IsNotEmpty(r.Problems);
        }

        [Test]
        public void Storage_ReportsMissingAndUnrecoverableSaves()
        {
            var storage = new SaveStorage(_dir);
            var missing = storage.Load("nada");
            Assert.IsFalse(missing.Success);
            Assert.AreEqual(SaveError.NotFound, missing.Error);

            storage.Save("x", BusySession().CreateSnapshot(0));
            File.WriteAllBytes(storage.PathFor("x"), new byte[] { 0, 1, 2 });
            var broken = storage.Load("x");
            Assert.IsFalse(broken.Success);
            Assert.AreEqual(SaveError.Corrupted, broken.Error);
        }

        [Test]
        public void Storage_RejectsUnsafeSlotNames()
        {
            var storage = new SaveStorage(_dir);
            Assert.Throws<ArgumentException>(() => storage.PathFor("../hack"));
            Assert.Throws<ArgumentException>(() => storage.PathFor(""));
        }

        [Test]
        public void Summary_DescribesSave()
        {
            var storage = new SaveStorage(_dir);
            var s = BusySession();
            storage.Save("manual", s.CreateSnapshot(42));
            var summary = storage.PeekSummary("manual");
            Assert.AreEqual(s.Player.Name, summary.CompanyName);
            Assert.AreEqual(s.Player.Cash.Cents, summary.CashCents);
            Assert.AreEqual(s.Clock.TotalTicks, summary.TotalTicks);
            Assert.AreEqual(42, summary.SavedAtUnixMs);
        }
    }
}
