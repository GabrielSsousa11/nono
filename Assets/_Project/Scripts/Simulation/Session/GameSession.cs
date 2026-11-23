using System;
using System.Collections.Generic;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.Session
{
    /// <summary>
    /// Raiz da simulação de uma partida. Não depende da Unity: pode rodar em testes,
    /// em ferramentas de balanceamento ou em um servidor.
    /// Toda alteração de estado do jogo passa pelos comandos públicos desta classe,
    /// que validam as regras antes de executar (Can* / Execute*).
    /// </summary>
    public sealed class GameSession
    {
        public readonly GameConfig Config;
        public readonly EventBus Events = new EventBus();
        public readonly SimulationClock Clock;
        public readonly CityMap City;
        public readonly BuildingCatalog Catalog;
        public readonly LandMarket LandMarket;
        public readonly Company Player;

        private readonly Dictionary<int, Company> _companies = new Dictionary<int, Company>();
        private readonly Dictionary<int, BuildingInstance> _buildings = new Dictionary<int, BuildingInstance>();
        private readonly List<BuildingInstance> _busyScratch = new List<BuildingInstance>();
        private int _nextBuildingId = 1;

        public GameSession(GameConfig config, IEnumerable<BuildingDefinition> definitions)
        {
            Config = config ?? throw new ArgumentNullException(nameof(config));
            Config.Validate();
            Catalog = new BuildingCatalog(definitions);
            LandMarket = new LandMarket(Config.Economy);
            Clock = new SimulationClock(Config.SecondsPerTick, Config.MaxTicksPerFrame, Config.StartHour);
            City = CityGenerator.Generate(0, Config.City);

            Player = AddCompany(new Company(0, Config.PlayerCompanyName, isPlayer: true));
            Player.Credit(Config.StartingCash, TransactionCategory.InitialCapital, Clock.TotalTicks, "Capital inicial");

            var starter = FindStarterLot();
            if (starter != null) AssignOwnership(starter, Player.Id);
        }

        public IEnumerable<Company> Companies => _companies.Values;
        public IEnumerable<BuildingInstance> Buildings => _buildings.Values;
        public int BuildingCount => _buildings.Count;

        public Company GetCompany(int id) => _companies.TryGetValue(id, out var c) ? c : null;
        public BuildingInstance GetBuilding(int id) => _buildings.TryGetValue(id, out var b) ? b : null;

        public BuildingInstance GetBuildingOnLot(Lot lot) => lot != null && lot.HasBuilding ? GetBuilding(lot.BuildingId) : null;

        private Company AddCompany(Company c)
        {
            _companies.Add(c.Id, c);
            c.CashChanged += (company, delta) => Events.Publish(new CashChanged(company.Id, company.Cash, delta));
            return c;
        }

        // ------------------------------------------------------------------ Tempo

        /// <summary>Avança a simulação pelo tempo real decorrido. Retorna o número de ticks processados.</summary>
        public int Advance(double realDeltaSeconds)
        {
            int ticks = Clock.Advance(realDeltaSeconds);
            for (int i = 0; i < ticks; i++) StepTick();
            return ticks;
        }

        /// <summary>Processa exatamente um tick (1 hora de jogo).</summary>
        public void StepTick()
        {
            ProgressConstruction();
            Clock.CommitTick();
            if (Clock.Hour == 0) OnNewDay();
        }

        /// <summary>Processa N horas de jogo imediatamente (ferramentas de teste/balanceamento).</summary>
        public void StepHours(int hours)
        {
            for (int i = 0; i < hours; i++) StepTick();
        }

        private void ProgressConstruction()
        {
            _busyScratch.Clear();
            foreach (var b in _buildings.Values) if (b.IsBusy) _busyScratch.Add(b);

            foreach (var b in _busyScratch)
            {
                b.WorkDoneHours++;
                if (b.WorkDoneHours < b.WorkTotalHours) continue;

                if (b.State == BuildingState.Upgrading) b.Level++;
                b.State = BuildingState.Operational;
                b.WorkDoneHours = 0;
                b.WorkTotalHours = 0;
                Events.Publish(new BuildingStateChanged(b.Id));
            }
        }

        private void OnNewDay()
        {
            long tick = Clock.TotalTicks;
            foreach (var b in _buildings.Values)
            {
                // Obras em andamento não geram manutenção; a melhoria em curso mantém a do nível atual.
                if (b.State == BuildingState.UnderConstruction) continue;
                var owner = GetCompany(b.OwnerId);
                owner?.Charge(b.Definition.MaintenanceAtLevel(b.Level), TransactionCategory.Maintenance, tick,
                    "Manutenção: " + b.Definition.DisplayName);
            }

            foreach (var lot in City.Lots)
            {
                if (!lot.IsOwned) continue;
                var owner = GetCompany(lot.OwnerId);
                owner?.Charge(LandMarket.DailyPropertyTax(lot), TransactionCategory.PropertyTax, tick,
                    "Imposto predial: terreno #" + lot.Id);
            }

            foreach (var c in _companies.Values) c.Ledger.EnsureDay(Clock.TotalDays);
            Events.Publish(new DayStarted(Clock.TotalDays));
        }

        /// <summary>Custo diário recorrente estimado (manutenção + imposto predial) de uma empresa.</summary>
        public Money DailyUpkeep(int companyId)
        {
            Money total = Money.Zero;
            foreach (var b in _buildings.Values)
                if (b.OwnerId == companyId && b.State != BuildingState.UnderConstruction)
                    total += b.Definition.MaintenanceAtLevel(b.Level);
            foreach (var lot in City.Lots)
                if (lot.OwnerId == companyId) total += LandMarket.DailyPropertyTax(lot);
            return total;
        }

        // ------------------------------------------------------------------ Terrenos

        public CommandResult CanBuyLot(int companyId, int lotId)
        {
            var company = GetCompany(companyId);
            if (company == null) return CommandResult.Fail(CommandError.UnknownCompany);
            var lot = City.GetLot(lotId);
            if (lot == null) return CommandResult.Fail(CommandError.UnknownLot);
            if (lot.OwnerId == companyId) return CommandResult.Fail(CommandError.LotAlreadyOwned);
            if (!lot.IsForSale) return CommandResult.Fail(CommandError.LotNotForSale);
            var cost = LandMarket.PurchaseCost(lot);
            if (!company.CanAfford(cost)) return CommandResult.Fail(CommandError.InsufficientFunds, cost);
            return CommandResult.Ok(cost, lot.Id);
        }

        public CommandResult BuyLot(int companyId, int lotId)
        {
            var check = CanBuyLot(companyId, lotId);
            if (!check.Success) return check;

            var company = GetCompany(companyId);
            var lot = City.GetLot(lotId);
            var price = LandMarket.MarketValue(lot);
            var tax = LandMarket.TransferTax(lot);
            long tick = Clock.TotalTicks;

            if (!company.TryDebit(price, TransactionCategory.LandPurchase, tick, "Compra do terreno #" + lot.Id))
                return CommandResult.Fail(CommandError.InsufficientFunds, check.Amount);
            company.Charge(tax, TransactionCategory.TransferTax, tick, "Imposto de transmissão: terreno #" + lot.Id);

            AssignOwnership(lot, companyId);
            return CommandResult.Ok(check.Amount, lot.Id);
        }

        public CommandResult CanSellLot(int companyId, int lotId)
        {
            var lot = City.GetLot(lotId);
            if (lot == null) return CommandResult.Fail(CommandError.UnknownLot);
            if (GetCompany(companyId) == null) return CommandResult.Fail(CommandError.UnknownCompany);
            if (lot.OwnerId != companyId) return CommandResult.Fail(CommandError.LotNotOwned);
            if (lot.HasBuilding) return CommandResult.Fail(CommandError.LotHasBuilding);
            return CommandResult.Ok(LandMarket.SaleValue(lot), lot.Id);
        }

        public CommandResult SellLot(int companyId, int lotId)
        {
            var check = CanSellLot(companyId, lotId);
            if (!check.Success) return check;
            var lot = City.GetLot(lotId);
            GetCompany(companyId).Credit(check.Amount, TransactionCategory.LandSale, Clock.TotalTicks, "Venda do terreno #" + lot.Id);
            AssignOwnership(lot, Lot.NoOwner);
            return check;
        }

        private void AssignOwnership(Lot lot, int newOwner)
        {
            int previous = lot.OwnerId;
            lot.OwnerId = newOwner;
            Events.Publish(new LotOwnershipChanged(lot.Id, previous, newOwner));
        }

        /// <summary>Terreno inicial do jogador: o comercial à venda mais próximo do centro (determinístico).</summary>
        private Lot FindStarterLot()
        {
            Lot best = null;
            foreach (var lot in City.Lots)
            {
                if (!lot.IsForSale || lot.District != District.Commercial) continue;
                if (best == null || lot.DistanceToCenter01 < best.DistanceToCenter01) best = lot;
            }
            return best;
        }

        // ------------------------------------------------------------------ Construção

        public CommandResult CanConstruct(int companyId, int lotId, string definitionId)
        {
            var company = GetCompany(companyId);
            if (company == null) return CommandResult.Fail(CommandError.UnknownCompany);
            var lot = City.GetLot(lotId);
            if (lot == null) return CommandResult.Fail(CommandError.UnknownLot);
            var def = Catalog.Get(definitionId);
            if (def == null) return CommandResult.Fail(CommandError.UnknownDefinition);
            if (lot.OwnerId != companyId) return CommandResult.Fail(CommandError.LotNotOwned, def.ConstructionCost);
            if (lot.HasBuilding || lot.IsAmbient) return CommandResult.Fail(CommandError.LotOccupied, def.ConstructionCost);
            if (!def.AllowedDistricts.Allows(lot.District)) return CommandResult.Fail(CommandError.DistrictNotAllowed, def.ConstructionCost);
            if (lot.Rect.Area < def.MinLotArea) return CommandResult.Fail(CommandError.LotTooSmall, def.ConstructionCost);
            if (!company.CanAfford(def.ConstructionCost)) return CommandResult.Fail(CommandError.InsufficientFunds, def.ConstructionCost);
            return CommandResult.Ok(def.ConstructionCost);
        }

        public CommandResult Construct(int companyId, int lotId, string definitionId)
        {
            var check = CanConstruct(companyId, lotId, definitionId);
            if (!check.Success) return check;

            var company = GetCompany(companyId);
            var lot = City.GetLot(lotId);
            var def = Catalog.Get(definitionId);
            if (!company.TryDebit(def.ConstructionCost, TransactionCategory.Construction, Clock.TotalTicks, "Construção: " + def.DisplayName))
                return CommandResult.Fail(CommandError.InsufficientFunds, def.ConstructionCost);

            var building = new BuildingInstance(_nextBuildingId++, def, lot.Id, companyId)
            {
                State = BuildingState.UnderConstruction,
                WorkDoneHours = 0,
                WorkTotalHours = def.ConstructionHours,
                TotalInvested = def.ConstructionCost,
            };
            _buildings.Add(building.Id, building);
            lot.BuildingId = building.Id;
            Events.Publish(new BuildingPlaced(building.Id, lot.Id));
            return CommandResult.Ok(def.ConstructionCost, building.Id);
        }

        public CommandResult CanUpgrade(int companyId, int buildingId)
        {
            var company = GetCompany(companyId);
            if (company == null) return CommandResult.Fail(CommandError.UnknownCompany);
            var b = GetBuilding(buildingId);
            if (b == null) return CommandResult.Fail(CommandError.UnknownBuilding);
            if (b.OwnerId != companyId) return CommandResult.Fail(CommandError.NotBuildingOwner);
            if (b.Level >= b.Definition.MaxLevel) return CommandResult.Fail(CommandError.MaxLevelReached);
            var cost = b.Definition.UpgradeCost(b.Level);
            if (b.IsBusy) return CommandResult.Fail(CommandError.BuildingBusy, cost);
            if (!company.CanAfford(cost)) return CommandResult.Fail(CommandError.InsufficientFunds, cost);
            return CommandResult.Ok(cost, b.Id);
        }

        public CommandResult Upgrade(int companyId, int buildingId)
        {
            var check = CanUpgrade(companyId, buildingId);
            if (!check.Success) return check;
            var b = GetBuilding(buildingId);
            var company = GetCompany(companyId);
            if (!company.TryDebit(check.Amount, TransactionCategory.Upgrade, Clock.TotalTicks,
                    "Melhoria nível " + (b.Level + 1) + ": " + b.Definition.DisplayName))
                return CommandResult.Fail(CommandError.InsufficientFunds, check.Amount);

            b.State = BuildingState.Upgrading;
            b.WorkDoneHours = 0;
            b.WorkTotalHours = b.Definition.UpgradeHours(b.Level);
            b.TotalInvested += check.Amount;
            Events.Publish(new BuildingStateChanged(b.Id));
            return check;
        }

        public Money DemolitionRefund(BuildingInstance b) => b.TotalInvested.Scale(Config.Economy.DemolitionRefundRatio);

        public CommandResult CanDemolish(int companyId, int buildingId)
        {
            if (GetCompany(companyId) == null) return CommandResult.Fail(CommandError.UnknownCompany);
            var b = GetBuilding(buildingId);
            if (b == null) return CommandResult.Fail(CommandError.UnknownBuilding);
            if (b.OwnerId != companyId) return CommandResult.Fail(CommandError.NotBuildingOwner);
            return CommandResult.Ok(DemolitionRefund(b), b.Id);
        }

        public CommandResult Demolish(int companyId, int buildingId)
        {
            var check = CanDemolish(companyId, buildingId);
            if (!check.Success) return check;
            var b = GetBuilding(buildingId);
            var lot = City.GetLot(b.LotId);
            _buildings.Remove(b.Id);
            lot.BuildingId = Lot.NoBuilding;
            GetCompany(companyId).Credit(check.Amount, TransactionCategory.DemolitionRefund, Clock.TotalTicks,
                "Demolição: " + b.Definition.DisplayName);
            Events.Publish(new BuildingRemoved(b.Id, lot.Id));
            return check;
        }
    }
}
