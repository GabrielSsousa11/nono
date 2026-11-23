using System;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Zoneamento urbano. A ordem é usada como índice em tabelas de configuração.</summary>
    public enum District
    {
        Residential = 0,
        Commercial = 1,
        Industrial = 2,
        Downtown = 3,
        Park = 4,
    }

    [Flags]
    public enum DistrictMask
    {
        None = 0,
        Residential = 1 << District.Residential,
        Commercial = 1 << District.Commercial,
        Industrial = 1 << District.Industrial,
        Downtown = 1 << District.Downtown,
        Park = 1 << District.Park,
    }

    public static class DistrictExtensions
    {
        public static DistrictMask ToMask(this District d) => (DistrictMask)(1 << (int)d);
        public static bool Allows(this DistrictMask mask, District d) => (mask & d.ToMask()) != 0;
    }

    /// <summary>Estruturas de fundo da cidade (moradias, prédios de terceiros, praças).
    /// Ocupam terrenos não comercializáveis e, a partir da Fase 3, compõem a população/demanda.</summary>
    public enum AmbientStructure
    {
        None = 0,
        House,
        Apartment,
        OfficeTower,
        Shop,
        Warehouse,
        Park,
    }

    public enum CellType : byte
    {
        Empty = 0,
        Road = 1,
        Lot = 2,
    }
}
