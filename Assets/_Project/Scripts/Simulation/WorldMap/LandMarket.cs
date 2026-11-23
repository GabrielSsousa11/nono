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

        /// <summary>Valor de mercado: preço base do distrito × área × bônus de centralidade.</summary>
        public Money MarketValue(Lot lot)
        {
            long perCell = _cfg.LandPricePerCell[(int)lot.District];
            double centrality = 1.0 + _cfg.CentralityBonus * (1.0 - Clamp01(lot.DistanceToCenter01));
            return Money.FromUnits(perCell * lot.Rect.Area).Scale(centrality);
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

        private static double Clamp01(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
    }
}
