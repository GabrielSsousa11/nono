using System;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.Economy
{
    /// <summary>
    /// Parâmetros econômicos configuráveis (preenchidos a partir de ScriptableObjects na Unity).
    /// Todas as razões de revenda são &lt; 1 para impedir ciclos de compra/venda lucrativos.
    /// </summary>
    [Serializable]
    public sealed class EconomyConfig
    {
        /// <summary>Preço base do terreno por célula, em unidades monetárias, indexado por <see cref="District"/>.</summary>
        public long[] LandPricePerCell = { 900, 1400, 700, 2600, 0 };

        /// <summary>Bônus de preço máximo no centro da cidade (0,6 = +60%).</summary>
        public double CentralityBonus = 0.6;

        /// <summary>Fração do valor de mercado recebida ao vender um terreno.</summary>
        public double LandSaleRatio = 0.8;

        /// <summary>Imposto de transmissão cobrado na compra (fração do preço).</summary>
        public double TransferTaxRate = 0.03;

        /// <summary>Imposto predial anual sobre o valor de mercado do terreno, cobrado diariamente (pro rata).</summary>
        public double PropertyTaxRatePerYear = 0.012;

        /// <summary>Fração do investimento em construção devolvida ao demolir.</summary>
        public double DemolitionRefundRatio = 0.25;

        /// <summary>Raio de vizinhança, em células, usado na valorização de terrenos.</summary>
        public int NeighborhoodRadiusCells = 9;

        /// <summary>Valorização máxima por bairro totalmente ocupado (0,12 = +12%).</summary>
        public double DevelopmentBonus = 0.12;

        /// <summary>Valorização por praça próxima (até 2 praças contam).</summary>
        public double ParkBonus = 0.04;

        /// <summary>Teto da valorização de bairro. Validado para não permitir lucro com compra e revenda.</summary>
        public double MaxNeighborhoodBonus = 0.18;

        public void Validate()
        {
            int districts = Enum.GetValues(typeof(District)).Length;
            if (LandPricePerCell == null || LandPricePerCell.Length != districts)
                throw new InvalidOperationException("LandPricePerCell deve ter " + districts + " valores (um por distrito).");
            foreach (var p in LandPricePerCell)
                if (p < 0) throw new InvalidOperationException("Preço de terreno não pode ser negativo.");
            CheckRatio(LandSaleRatio, nameof(LandSaleRatio), maxExclusive: 1.0);
            CheckRatio(DemolitionRefundRatio, nameof(DemolitionRefundRatio), maxExclusive: 1.0);
            CheckRatio(TransferTaxRate, nameof(TransferTaxRate), maxExclusive: 1.0);
            CheckRatio(PropertyTaxRatePerYear, nameof(PropertyTaxRatePerYear), maxExclusive: 1.0);
            if (CentralityBonus < 0 || CentralityBonus > 5) throw new InvalidOperationException("CentralityBonus fora do intervalo [0, 5].");
            if (NeighborhoodRadiusCells < 1) throw new InvalidOperationException("NeighborhoodRadiusCells deve ser >= 1.");
            if (DevelopmentBonus < 0 || ParkBonus < 0 || MaxNeighborhoodBonus < 0) throw new InvalidOperationException("Bônus de bairro não podem ser negativos.");
            // Anti-exploit: mesmo com a valorização máxima, vender rende menos do que custou comprar.
            if (LandSaleRatio * (1.0 + MaxNeighborhoodBonus) >= 1.0 + TransferTaxRate)
                throw new InvalidOperationException("LandSaleRatio × (1 + MaxNeighborhoodBonus) deve ser menor que 1 + TransferTaxRate (evita lucro com revenda).");
        }

        private static void CheckRatio(double value, string name, double maxExclusive)
        {
            if (double.IsNaN(value) || value < 0 || value >= maxExclusive)
                throw new InvalidOperationException(name + " deve estar em [0, " + maxExclusive + ").");
        }
    }
}
