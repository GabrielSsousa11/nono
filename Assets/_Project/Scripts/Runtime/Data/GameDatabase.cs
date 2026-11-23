using System.Collections.Generic;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Session;
using UnityEngine;

namespace EmpireTycoon.Runtime.Data
{
    /// <summary>
    /// Ponto único de acesso aos dados configuráveis do jogo. Fica em Resources/ para que
    /// o bootstrap o encontre mesmo sem referência na cena.
    /// </summary>
    [CreateAssetMenu(menuName = "Empire Tycoon/Game Database", fileName = "GameDatabase")]
    public sealed class GameDatabase : ScriptableObject
    {
        public const string ResourcePath = "GameDatabase";

        [Tooltip("Configuração de uma nova partida (capital, cidade, economia, relógio).")]
        public GameConfig newGameConfig = new GameConfig();

        public List<BuildingDefinitionAsset> buildings = new List<BuildingDefinitionAsset>();

        [Header("Renderização")]
        [Tooltip("Material base (URP Simple Lit) usado para gerar as cores dos modelos. Criado pelo menu Empire Tycoon > Configurar Projeto.")]
        public Material litMaterialTemplate;

        [Tooltip("Tamanho de uma célula do grid em metros.")]
        [Min(1f)] public float cellSize = 4f;

        public List<BuildingDefinition> CreateDefinitions()
        {
            var list = new List<BuildingDefinition>(buildings.Count);
            foreach (var asset in buildings)
                if (asset != null) list.Add(asset.ToDefinition());
            return list;
        }

        public BuildingDefinitionAsset FindAsset(string id)
        {
            foreach (var asset in buildings)
                if (asset != null && asset.id == id) return asset;
            return null;
        }
    }
}
