using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Regras de quais estruturas de fundo surgem em cada zona (geração inicial e crescimento da cidade).</summary>
    public static class AmbientRules
    {
        public static void Pick(District district, DeterministicRandom rng, out AmbientStructure type, out int floors)
        {
            switch (district)
            {
                case District.Residential:
                    type = rng.Chance(0.75) ? AmbientStructure.House : AmbientStructure.Apartment;
                    floors = type == AmbientStructure.House ? rng.Range(1, 3) : rng.Range(3, 6);
                    break;
                case District.Commercial:
                    type = rng.Chance(0.6) ? AmbientStructure.Shop : AmbientStructure.Apartment;
                    floors = type == AmbientStructure.Shop ? rng.Range(1, 3) : rng.Range(4, 8);
                    break;
                case District.Downtown:
                    type = AmbientStructure.OfficeTower;
                    floors = rng.Range(8, 20);
                    break;
                case District.Industrial:
                    type = AmbientStructure.Warehouse;
                    floors = 1;
                    break;
                default:
                    type = AmbientStructure.Park;
                    floors = 0;
                    break;
            }
        }

        /// <summary>Moradores aproximados de uma estrutura.</summary>
        public static int Residents(AmbientStructure type, int floors)
        {
            switch (type)
            {
                case AmbientStructure.House: return 4 * floors;
                case AmbientStructure.Apartment: return 16 * floors;
                default: return 0;
            }
        }

        /// <summary>Postos de trabalho aproximados de uma estrutura.</summary>
        public static int Jobs(AmbientStructure type, int floors)
        {
            switch (type)
            {
                case AmbientStructure.OfficeTower: return 45 * floors;
                case AmbientStructure.Shop: return 10 * floors;
                case AmbientStructure.Warehouse: return 25;
                case AmbientStructure.Apartment: return 2;
                default: return 0;
            }
        }
    }
}
