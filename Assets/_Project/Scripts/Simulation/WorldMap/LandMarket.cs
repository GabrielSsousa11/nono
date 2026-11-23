using System;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Precificação de terrenos. Puro (sem estado), configurado por <see cref="EconomyConfig"/>.</summary>
    public sealed class LandMarket
    {
        private readonly EconomyConfig _cfg;

        public LandMarket(EconomyConfig cfg)
        {
            _cfg = cfg ?? throw new ArgumentNullException(nameof(cfg));
        }

        /// <summary>Valor de mercado: preço base do distrito × área × centralidade × valorização do bairro.</summary>
        public Money MarketValue(Lot lot)
        {
            long perCell = _cfg.LandPricePerCell[(int)lot.District];
            double centrality = 1.0 + _cfg.CentralityBonus * (1.0 - Clamp01(lot.DistanceToCenter01));
            double neighborhood = 1.0 + Math.Min(lot.NeighborhoodBonus, _cfg.MaxNeighborhoodBonus);
            return Money.FromUnits(perCell * lot.Rect.Area).Scale(centrality * neighborhood);
        }

        public Money TransferTax(Lot lot) => MarketValue(lot).Scale(_cfg.TransferTaxRate);

        /// <summary>Custo total para comprar (preço + imposto de transmissão).</summary>
        public Money PurchaseCost(Lot lot) => MarketValue(lot) + TransferTax(lot);

        /// <summary>Valor recebido na venda (sempre menor que o custo de compra).</summary>
        public Money SaleValue(Lot lot) => MarketValue(lot).Scale(_cfg.LandSaleRatio);

        /// <summary>Imposto predial diário (anual / 360 dias).</summary>
        public Money DailyPropertyTax(Lot lot)
        {
            int daysPerYear = SimulationClock.DaysPerMonth * SimulationClock.MonthsPerYear;
            return MarketValue(lot).Scale(_cfg.PropertyTaxRatePerYear / daysPerYear);
        }

        /// <summary>
        /// Recalcula a valorização de bairro de todos os terrenos: ocupação da vizinhança e praças próximas.
        /// Chamado uma vez por dia, para que os preços fiquem estáveis ao longo do dia.
        /// </summary>
        public void RecomputeNeighborhood(CityMap city)
        {
            var lots = city.Lots;
            int n = lots.Count;
            float r = _cfg.NeighborhoodRadiusCells;
            float r2 = r * r;
            for (int i = 0; i < n; i++)
            {
                var lot = lots[i];
                if (lot.District == District.Park) { lot.NeighborhoodBonus = 0; continue; }
                int neighbors = 0, developed = 0, parks = 0;
                for (int j = 0; j < n; j++)
                {
                    if (i == j) continue;
                    var other = lots[j];
                    float dx = other.Rect.CenterX - lot.Rect.CenterX, dy = other.Rect.CenterY - lot.Rect.CenterY;
                    if (dx * dx + dy * dy > r2) continue;
                    if (other.District == District.Park) { parks++; continue; }
                    neighbors++;
                    if (other.IsDeveloped) developed++;
                }
                double bonus = (neighbors > 0 ? _cfg.DevelopmentBonus * developed / neighbors : 0) + _cfg.ParkBonus * Math.Min(parks, 2);
                lot.NeighborhoodBonus = Math.Min(bonus, _cfg.MaxNeighborhoodBonus);
            }
        }

        private static double Clamp01(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
    }
}
