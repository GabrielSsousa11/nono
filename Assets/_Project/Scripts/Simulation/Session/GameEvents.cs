using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.Session
{
    // Eventos de domínio publicados pela GameSession no EventBus.
    // Estruturas imutáveis e pequenas: sem alocação em heap ao publicar.

    public readonly struct LotOwnershipChanged
    {
        public readonly int LotId;
        public readonly int PreviousOwnerId;
        public readonly int NewOwnerId;
        public LotOwnershipChanged(int lotId, int previousOwnerId, int newOwnerId)
        {
            LotId = lotId; PreviousOwnerId = previousOwnerId; NewOwnerId = newOwnerId;
        }
    }

    public readonly struct BuildingPlaced
    {
        public readonly int BuildingId;
        public readonly int LotId;
        public BuildingPlaced(int buildingId, int lotId) { BuildingId = buildingId; LotId = lotId; }
    }

    public readonly struct BuildingStateChanged
    {
        public readonly int BuildingId;
        public BuildingStateChanged(int buildingId) { BuildingId = buildingId; }
    }

    public readonly struct BuildingRemoved
    {
        public readonly int BuildingId;
        public readonly int LotId;
        public BuildingRemoved(int buildingId, int lotId) { BuildingId = buildingId; LotId = lotId; }
    }

    public readonly struct CashChanged
    {
        public readonly int CompanyId;
        public readonly Money NewCash;
        public readonly Money Delta;
        public CashChanged(int companyId, Money newCash, Money delta) { CompanyId = companyId; NewCash = newCash; Delta = delta; }
    }

    public readonly struct DayStarted
    {
        public readonly long Day;
        public DayStarted(long day) { Day = day; }
    }

    /// <summary>Um terreno começou ou terminou uma obra particular (crescimento da cidade).</summary>
    public readonly struct LotDevelopmentChanged
    {
        public readonly int LotId;
        public readonly bool Completed;
        public LotDevelopmentChanged(int lotId, bool completed) { LotId = lotId; Completed = completed; }
    }
}
