using System;
using System.Collections.Generic;

namespace EmpireTycoon.Simulation.Buildings
{
    /// <summary>Catálogo validado de tipos de edifício (ids únicos).</summary>
    public sealed class BuildingCatalog
    {
        private readonly List<BuildingDefinition> _all = new List<BuildingDefinition>();
        private readonly Dictionary<string, BuildingDefinition> _byId = new Dictionary<string, BuildingDefinition>(StringComparer.Ordinal);

        public BuildingCatalog(IEnumerable<BuildingDefinition> definitions)
        {
            if (definitions == null) throw new ArgumentNullException(nameof(definitions));
            foreach (var def in definitions)
            {
                if (def == null) throw new ArgumentException("Catálogo contém definição nula.");
                if (_byId.ContainsKey(def.Id)) throw new ArgumentException("Id de edifício duplicado: " + def.Id);
                _byId.Add(def.Id, def);
                _all.Add(def);
            }
            if (_all.Count == 0) throw new ArgumentException("Catálogo de edifícios vazio.");
        }

        public IReadOnlyList<BuildingDefinition> All => _all;

        public BuildingDefinition Get(string id) => id != null && _byId.TryGetValue(id, out var d) ? d : null;
    }
}
