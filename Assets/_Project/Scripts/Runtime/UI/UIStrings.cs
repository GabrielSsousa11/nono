using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>
    /// Textos da interface em pt-BR, centralizados para a futura localização (Fase 9).
    /// </summary>
    public static class UIStrings
    {
        public static string DistrictName(District d)
        {
            switch (d)
            {
                case District.Residential: return "Residencial";
                case District.Commercial: return "Comercial";
                case District.Industrial: return "Industrial";
                case District.Downtown: return "Centro";
                case District.Park: return "Praça";
                default: return d.ToString();
            }
        }

        public static string AmbientName(AmbientStructure a)
        {
            switch (a)
            {
                case AmbientStructure.House: return "Residência";
                case AmbientStructure.Apartment: return "Edifício residencial";
                case AmbientStructure.OfficeTower: return "Torre de escritórios";
                case AmbientStructure.Shop: return "Comércio local";
                case AmbientStructure.Warehouse: return "Galpão de terceiros";
                case AmbientStructure.Park: return "Praça pública";
                default: return "";
            }
        }

        public static string CategoryName(BuildingCategory c)
        {
            switch (c)
            {
                case BuildingCategory.Retail: return "Varejo";
                case BuildingCategory.Office: return "Escritório";
                case BuildingCategory.Industry: return "Indústria";
                case BuildingCategory.Storage: return "Armazenagem";
                default: return c.ToString();
            }
        }

        public static string StateName(BuildingState s)
        {
            switch (s)
            {
                case BuildingState.UnderConstruction: return "Em construção";
                case BuildingState.Upgrading: return "Em reforma (melhoria)";
                case BuildingState.Operational: return "Em operação";
                default: return s.ToString();
            }
        }

        public static string AllowedDistricts(DistrictMask mask)
        {
            var sb = new System.Text.StringBuilder();
            foreach (District d in System.Enum.GetValues(typeof(District)))
            {
                if (!mask.Allows(d)) continue;
                if (sb.Length > 0) sb.Append(", ");
                sb.Append(DistrictName(d));
            }
            return sb.ToString();
        }

        public static string ErrorText(CommandError e)
        {
            switch (e)
            {
                case CommandError.None: return "";
                case CommandError.InsufficientFunds: return "Saldo insuficiente";
                case CommandError.LotNotForSale: return "Terreno não está à venda";
                case CommandError.LotAlreadyOwned: return "Você já possui este terreno";
                case CommandError.LotNotOwned: return "Você não possui este terreno";
                case CommandError.LotOccupied: return "Terreno ocupado";
                case CommandError.LotHasBuilding: return "Demolir o edifício antes de vender";
                case CommandError.LotTooSmall: return "Terreno pequeno demais";
                case CommandError.DistrictNotAllowed: return "Zoneamento não permite";
                case CommandError.BuildingBusy: return "Obra em andamento";
                case CommandError.MaxLevelReached: return "Nível máximo atingido";
                case CommandError.NotBuildingOwner: return "Edifício de outra empresa";
                default: return "Ação indisponível";
            }
        }

        public static string Hours(int hours)
        {
            if (hours < 24) return hours + " h";
            int d = hours / 24, h = hours % 24;
            return h == 0 ? d + (d == 1 ? " dia" : " dias") : d + "d " + h + "h";
        }

        public static string FormatMoney(Money m) => Money.Format(m);
        public static string FormatMoneyShort(Money m) => Money.FormatCompact(m);
    }
}
