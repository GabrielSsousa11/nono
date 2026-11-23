using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.Buildings
{
    public enum BuildingState
    {
        UnderConstruction = 0,
        Operational = 1,
        Upgrading = 2,
    }

    /// <summary>Estabelecimento construído (ou em obras) sobre um terreno.</summary>
    public sealed class BuildingInstance
    {
        public readonly int Id;
        public readonly BuildingDefinition Definition;
        public readonly int LotId;
        public readonly int OwnerId;

        public int Level { get; internal set; } = 1;
        public BuildingState State { get; internal set; } = BuildingState.UnderConstruction;
        public int WorkDoneHours { get; internal set; }
        public int WorkTotalHours { get; internal set; }

        /// <summary>Total investido (construção + melhorias); base para o reembolso de demolição.</summary>
        public Money TotalInvested { get; internal set; }

        public BuildingInstance(int id, BuildingDefinition definition, int lotId, int ownerId)
        {
            Id = id;
            Definition = definition;
            LotId = lotId;
            OwnerId = ownerId;
        }

        public bool IsBusy => State != BuildingState.Operational;
        public bool CanUpgrade => State == BuildingState.Operational && Level < Definition.MaxLevel;

        public float WorkProgress01 => WorkTotalHours <= 0 ? 1f : (float)WorkDoneHours / WorkTotalHours;

        public int RemainingHours => WorkTotalHours - WorkDoneHours;
    }
}
