using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Terreno urbano. Pertence ao município (<see cref="NoOwner"/>) ou a uma empresa.</summary>
    public sealed class Lot
    {
        public const int NoOwner = -1;
        public const int NoBuilding = -1;

        public readonly int Id;
        public readonly GridRect Rect;
        public readonly District District;

        /// <summary>Distância normalizada ao centro: 0 = centro, 1 = borda.</summary>
        public readonly double DistanceToCenter01;

        public AmbientStructure Ambient { get; internal set; }
        public int AmbientFloors { get; internal set; }
        public int OwnerId { get; internal set; } = NoOwner;
        public int BuildingId { get; internal set; } = NoBuilding;

        public Lot(int id, GridRect rect, District district, double distanceToCenter01)
        {
            Id = id;
            Rect = rect;
            District = district;
            DistanceToCenter01 = distanceToCenter01;
        }

        public bool IsOwned => OwnerId != NoOwner;
        public bool HasBuilding => BuildingId != NoBuilding;
        public bool IsAmbient => Ambient != AmbientStructure.None;

        /// <summary>À venda pelo município: sem dono, sem estrutura de fundo e zoneado para uso empresarial.</summary>
        public bool IsForSale => !IsOwned && !IsAmbient && District != District.Park;
    }
}
