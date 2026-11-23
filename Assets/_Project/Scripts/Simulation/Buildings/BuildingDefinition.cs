using System;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.Buildings
{
    public enum BuildingCategory
    {
        Retail = 0,
        Office = 1,
        Industry = 2,
        Storage = 3,
    }

    /// <summary>
    /// Dados imutáveis de um tipo de estabelecimento. Na Unity é criado a partir de
    /// <c>BuildingDefinitionAsset</c> (ScriptableObject); aqui é C# puro para ser testável.
    /// </summary>
    public sealed class BuildingDefinition
    {
        public readonly string Id;
        public readonly string DisplayName;
        public readonly string Description;
        public readonly BuildingCategory Category;
        public readonly DistrictMask AllowedDistricts;
        public readonly int MinLotArea;
        public readonly Money ConstructionCost;
        public readonly int ConstructionHours;
        public readonly Money DailyMaintenance;
        public readonly int MaxLevel;

        /// <summary>Custo de melhoria para o nível N+1 = ConstructionCost × UpgradeCostFactor × N.</summary>
        public readonly double UpgradeCostFactor;

        /// <summary>Duração da melhoria = ConstructionHours × UpgradeTimeFactor.</summary>
        public readonly double UpgradeTimeFactor;

        /// <summary>Crescimento da manutenção por nível acima do 1 (0,5 = +50% por nível).</summary>
        public readonly double MaintenanceGrowthPerLevel;

        /// <summary>Chave do estilo visual usado pela camada de renderização.</summary>
        public readonly string VisualKey;

        public BuildingDefinition(
            string id, string displayName, string description, BuildingCategory category,
            DistrictMask allowedDistricts, int minLotArea, Money constructionCost, int constructionHours,
            Money dailyMaintenance, int maxLevel, double upgradeCostFactor, double upgradeTimeFactor,
            double maintenanceGrowthPerLevel, string visualKey)
        {
            Id = id;
            DisplayName = displayName;
            Description = description ?? string.Empty;
            Category = category;
            AllowedDistricts = allowedDistricts;
            MinLotArea = minLotArea;
            ConstructionCost = constructionCost;
            ConstructionHours = constructionHours;
            DailyMaintenance = dailyMaintenance;
            MaxLevel = maxLevel;
            UpgradeCostFactor = upgradeCostFactor;
            UpgradeTimeFactor = upgradeTimeFactor;
            MaintenanceGrowthPerLevel = maintenanceGrowthPerLevel;
            VisualKey = string.IsNullOrEmpty(visualKey) ? id : visualKey;
            Validate();
        }

        private void Validate()
        {
            if (string.IsNullOrWhiteSpace(Id)) throw new ArgumentException("Definição de edifício sem Id.");
            string p = "Edifício '" + Id + "': ";
            if (string.IsNullOrWhiteSpace(DisplayName)) throw new ArgumentException(p + "nome vazio.");
            if (AllowedDistricts == DistrictMask.None) throw new ArgumentException(p + "nenhum distrito permitido.");
            if (MinLotArea <= 0) throw new ArgumentException(p + "área mínima deve ser positiva.");
            if (ConstructionCost.Cents <= 0) throw new ArgumentException(p + "custo de construção deve ser positivo.");
            if (ConstructionHours <= 0) throw new ArgumentException(p + "tempo de construção deve ser positivo.");
            if (DailyMaintenance.IsNegative) throw new ArgumentException(p + "manutenção negativa.");
            if (MaxLevel < 1 || MaxLevel > 20) throw new ArgumentException(p + "nível máximo deve estar entre 1 e 20.");
            if (UpgradeCostFactor <= 0) throw new ArgumentException(p + "fator de custo de melhoria deve ser positivo.");
            if (UpgradeTimeFactor <= 0) throw new ArgumentException(p + "fator de tempo de melhoria deve ser positivo.");
            if (MaintenanceGrowthPerLevel < 0) throw new ArgumentException(p + "crescimento de manutenção negativo.");
        }

        /// <summary>Custo para melhorar do nível <paramref name="currentLevel"/> para o seguinte.</summary>
        public Money UpgradeCost(int currentLevel)
        {
            if (currentLevel < 1) throw new ArgumentOutOfRangeException(nameof(currentLevel));
            return ConstructionCost.Scale(UpgradeCostFactor * currentLevel);
        }

        public int UpgradeHours(int currentLevel) => Math.Max(1, (int)Math.Round(ConstructionHours * UpgradeTimeFactor * Math.Sqrt(currentLevel)));

        public Money MaintenanceAtLevel(int level)
        {
            if (level < 1) throw new ArgumentOutOfRangeException(nameof(level));
            return DailyMaintenance.Scale(1.0 + MaintenanceGrowthPerLevel * (level - 1));
        }
    }
}
