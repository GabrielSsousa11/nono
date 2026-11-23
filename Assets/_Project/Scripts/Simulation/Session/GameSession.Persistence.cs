using System;
using System.Collections.Generic;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.SaveSystem;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.Session
{
    /// <summary>Conversão entre a partida em memória e o <see cref="GameSnapshot"/> salvo em disco.</summary>
    public sealed partial class GameSession
    {
        /// <summary>
        /// Restaura uma partida salva. A cidade é regenerada pela semente salva e o estado variável é aplicado
        /// por cima. Parâmetros de economia/relógio vêm da configuração atual (permite rebalancear o jogo
        /// sem invalidar saves).
        /// </summary>
        public static GameSession Restore(GameConfig config, IEnumerable<BuildingDefinition> definitions, GameSnapshot snapshot, List<string> warnings = null)
        {
            if (snapshot == null) throw new ArgumentNullException(nameof(snapshot));
            if (snapshot.City == null) throw new SaveException(SaveError.IncompatibleData, "Save sem dados da cidade.");
            try
            {
                return new GameSession(config, definitions, snapshot, warnings);
            }
            catch (InvalidOperationException e)
            {
                throw new SaveException(SaveError.IncompatibleData, "Save incompatível: " + e.Message, e);
            }
        }

        public GameSnapshot CreateSnapshot(long savedAtUnixMs)
        {
            var s = new GameSnapshot
            {
                SavedAtUnixMs = savedAtUnixMs,
                PlayerCompanyName = Player.Name,
                City = CityLayout,
                TotalTicks = Clock.TotalTicks,
                Speed = (int)Clock.Speed,
                GrowthRngState = _growth.Rng.State,
                NextBuildingId = _nextBuildingId,
            };

            var companyIds = new List<int>(_companies.Keys);
            companyIds.Sort();
            foreach (int id in companyIds)
            {
                var c = _companies[id];
                var cs = new CompanySave { Id = c.Id, Name = c.Name, IsPlayer = c.IsPlayer, CashCents = c.Cash.Cents };
                foreach (var t in c.Ledger.Recent)
                    cs.Recent.Add(new TransactionSave { Tick = t.Tick, Category = (int)t.Category, AmountCents = t.Amount.Cents, Description = t.Description });
                foreach (var d in c.Ledger.DailyReports)
                    cs.Days.Add(new DailyReportSave { Day = d.Day, IncomeCents = d.Income.Cents, ExpensesCents = d.Expenses.Cents });
                var totals = new List<KeyValuePair<TransactionCategory, Money>>(c.Ledger.Totals);
                totals.Sort((a, b) => ((int)a.Key).CompareTo((int)b.Key));
                foreach (var kv in totals) cs.Totals.Add(new CategoryTotalSave { Category = (int)kv.Key, AmountCents = kv.Value.Cents });
                s.Companies.Add(cs);
            }

            foreach (var lot in City.Lots)
                s.Lots.Add(new LotSave
                {
                    OwnerId = lot.OwnerId,
                    BuildingId = lot.BuildingId,
                    Ambient = (int)lot.Ambient,
                    AmbientFloors = lot.AmbientFloors,
                    DevelopmentHoursLeft = lot.DevelopmentHoursLeft,
                    NeighborhoodBonus = lot.NeighborhoodBonus,
                });

            var buildingIds = new List<int>(_buildings.Keys);
            buildingIds.Sort();
            foreach (int id in buildingIds)
            {
                var b = _buildings[id];
                s.Buildings.Add(new BuildingSave
                {
                    Id = b.Id, DefinitionId = b.Definition.Id, LotId = b.LotId, OwnerId = b.OwnerId, Level = b.Level,
                    State = (int)b.State, WorkDoneHours = b.WorkDoneHours, WorkTotalHours = b.WorkTotalHours, InvestedCents = b.TotalInvested.Cents,
                });
            }
            return s;
        }

        private Company ApplySnapshot(GameSnapshot s, List<string> warnings)
        {
            if (s.Lots.Count != City.Lots.Count)
                throw new SaveException(SaveError.IncompatibleData,
                    "O mapa salvo tem " + s.Lots.Count + " terrenos, mas a cidade gerada tem " + City.Lots.Count + ".");
            if (Enum.IsDefined(typeof(GameSpeed), s.Speed)) Clock.Speed = (GameSpeed)s.Speed;

            Company player = null;
            foreach (var cs in s.Companies)
            {
                if (_companies.ContainsKey(cs.Id)) throw new SaveException(SaveError.IncompatibleData, "Empresa duplicada no save: " + cs.Id);
                var c = AddCompany(new Company(cs.Id, string.IsNullOrEmpty(cs.Name) ? "Empresa " + cs.Id : cs.Name, cs.IsPlayer));
                c.RestoreCash(new Money(cs.CashCents));
                var recent = new List<Transaction>();
                foreach (var t in cs.Recent) recent.Add(new Transaction(t.Tick, ToCategory(t.Category), new Money(t.AmountCents), t.Description));
                var days = new List<DailyReport>();
                foreach (var d in cs.Days) days.Add(new DailyReport { Day = d.Day, Income = new Money(d.IncomeCents), Expenses = new Money(d.ExpensesCents) });
                var totals = new List<KeyValuePair<TransactionCategory, Money>>();
                foreach (var t in cs.Totals) totals.Add(new KeyValuePair<TransactionCategory, Money>(ToCategory(t.Category), new Money(t.AmountCents)));
                c.Ledger.Restore(recent, days, totals);
                if (cs.IsPlayer)
                {
                    if (player != null) throw new SaveException(SaveError.IncompatibleData, "Save com mais de uma empresa do jogador.");
                    player = c;
                }
            }
            if (player == null) throw new SaveException(SaveError.IncompatibleData, "Save sem a empresa do jogador.");

            for (int i = 0; i < s.Lots.Count; i++)
            {
                var ls = s.Lots[i];
                var lot = City.Lots[i];
                lot.OwnerId = ls.OwnerId == Lot.NoOwner || _companies.ContainsKey(ls.OwnerId) ? ls.OwnerId : Lot.NoOwner;
                if (lot.OwnerId != ls.OwnerId) warnings.Add("Terreno #" + i + " tinha dono inexistente; devolvido à prefeitura.");
                lot.Ambient = Enum.IsDefined(typeof(AmbientStructure), ls.Ambient) ? (AmbientStructure)ls.Ambient : AmbientStructure.None;
                lot.AmbientFloors = Math.Max(0, ls.AmbientFloors);
                lot.DevelopmentHoursLeft = Math.Max(0, ls.DevelopmentHoursLeft);
                lot.NeighborhoodBonus = ls.NeighborhoodBonus;
                lot.BuildingId = Lot.NoBuilding; // reatribuído a partir da lista de edifícios
            }

            int maxId = 0;
            foreach (var bs in s.Buildings)
            {
                var lot = City.GetLot(bs.LotId);
                var owner = GetCompany(bs.OwnerId);
                var def = Catalog.Get(bs.DefinitionId);
                if (lot == null || owner == null || lot.HasBuilding || _buildings.ContainsKey(bs.Id))
                {
                    warnings.Add("Edifício #" + bs.Id + " inválido no save foi descartado.");
                    continue;
                }
                if (def == null)
                {
                    // Tipo removido do jogo: devolve o investimento integral e libera o terreno.
                    owner.Credit(new Money(Math.Max(0, bs.InvestedCents)), TransactionCategory.Compensation, Clock.TotalTicks,
                        "Compensação: edifício '" + bs.DefinitionId + "' não existe mais");
                    warnings.Add("Edifício '" + bs.DefinitionId + "' não existe mais; investimento devolvido.");
                    continue;
                }
                var state = Enum.IsDefined(typeof(BuildingState), bs.State) ? (BuildingState)bs.State : BuildingState.Operational;
                var b = new BuildingInstance(bs.Id, def, lot.Id, owner.Id)
                {
                    Level = Math.Max(1, Math.Min(bs.Level, def.MaxLevel)),
                    State = state,
                    WorkDoneHours = Math.Max(0, bs.WorkDoneHours),
                    WorkTotalHours = Math.Max(0, bs.WorkTotalHours),
                    TotalInvested = new Money(bs.InvestedCents),
                };
                if (b.IsBusy && b.WorkTotalHours <= b.WorkDoneHours) b.WorkTotalHours = b.WorkDoneHours + 1;
                _buildings.Add(b.Id, b);
                lot.BuildingId = b.Id;
                maxId = Math.Max(maxId, b.Id);
            }
            _nextBuildingId = Math.Max(s.NextBuildingId, maxId + 1);
            return player;
        }

        private static TransactionCategory ToCategory(int value) =>
            Enum.IsDefined(typeof(TransactionCategory), value) ? (TransactionCategory)value : TransactionCategory.Compensation;
    }
}
