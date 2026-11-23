using System;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Parâmetros do crescimento autônomo da cidade (moradores e empresas locais construindo).</summary>
    [Serializable]
    public sealed class CityGrowthConfig
    {
        public bool Enabled = true;

        /// <summary>Chance, a cada dia, de um novo empreendimento particular começar.</summary>
        public double DailyDevelopmentChance = 0.35;

        /// <summary>Duração da obra de um empreendimento particular, em horas.</summary>
        public int DevelopmentHours = 48;

        /// <summary>Fração mínima de terrenos de cada zona que permanece à venda (o jogador nunca fica sem opções).</summary>
        public double MinVacantFraction = 0.35;

        public void Validate()
        {
            if (DailyDevelopmentChance < 0 || DailyDevelopmentChance > 1) throw new InvalidOperationException("DailyDevelopmentChance deve estar em [0, 1].");
            if (DevelopmentHours < 1) throw new InvalidOperationException("DevelopmentHours deve ser >= 1.");
            if (MinVacantFraction < 0 || MinVacantFraction > 1) throw new InvalidOperationException("MinVacantFraction deve estar em [0, 1].");
        }
    }
}
