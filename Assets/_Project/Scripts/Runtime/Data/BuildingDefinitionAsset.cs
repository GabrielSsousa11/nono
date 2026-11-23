using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.WorldMap;
using UnityEngine;

namespace EmpireTycoon.Runtime.Data
{
    /// <summary>
    /// Tipo de estabelecimento configurável pelo Inspector. É convertido para
    /// <see cref="BuildingDefinition"/> (C# puro) quando a partida começa.
    /// </summary>
    [CreateAssetMenu(menuName = "Empire Tycoon/Building Definition", fileName = "Building_New")]
    public sealed class BuildingDefinitionAsset : ScriptableObject
    {
        [Header("Identidade")]
        [Tooltip("Identificador único e estável (usado em saves). Não altere após publicar.")]
        public string id = "new_building";
        public string displayName = "Novo edifício";
        [TextArea(2, 4)] public string description = "";
        public BuildingCategory category = BuildingCategory.Retail;

        [Header("Regras de construção")]
        public DistrictMask allowedDistricts = DistrictMask.Commercial;
        [Min(1)] public int minLotArea = 9;
        public long constructionCost = 20000;
        [Tooltip("Horas de jogo para concluir a obra.")]
        [Min(1)] public int constructionHours = 24;

        [Header("Operação")]
        public long dailyMaintenance = 100;
        [Range(1, 20)] public int maxLevel = 3;
        [Min(0.01f)] public float upgradeCostFactor = 0.6f;
        [Min(0.01f)] public float upgradeTimeFactor = 0.5f;
        [Min(0f)] public float maintenanceGrowthPerLevel = 0.5f;

        [Header("Visual")]
        [Tooltip("Estilo do gerador procedural (grocery, bakery, office, factory, warehouse).")]
        public string visualKey = "grocery";
        [Tooltip("Modelo final (Blender/FBX). Quando definido, substitui o modelo procedural.")]
        public GameObject modelPrefab;
        public Color wallColor = new Color(0.93f, 0.89f, 0.82f);
        public Color roofColor = new Color(0.36f, 0.38f, 0.42f);
        public Color accentColor = new Color(0.85f, 0.25f, 0.2f);
        [Tooltip("Ícone para a interface (opcional).")]
        public Sprite icon;

        public BuildingDefinition ToDefinition()
        {
            return new BuildingDefinition(
                id, displayName, description, category, allowedDistricts, minLotArea,
                Money.FromUnits(constructionCost), constructionHours, Money.FromUnits(dailyMaintenance),
                maxLevel, upgradeCostFactor, upgradeTimeFactor, maintenanceGrowthPerLevel, visualKey);
        }
    }
}
