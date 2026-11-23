using System;
using System.Collections.Generic;
using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>
    /// Crescimento autônomo da cidade: moradores e empresas locais ocupam terrenos vagos ao longo do tempo,
    /// tornando terrenos mais escassos e valorizando bairros. Determinístico (RNG próprio, salvo no save).
    /// A demanda direciona o crescimento: com mais empregos que moradores, surgem moradias; caso contrário, comércio.
    /// </summary>
    public sealed class CityGrowth
    {
        private readonly CityMap _city;
        private readonly CityGrowthConfig _cfg;
        private readonly List<Lot> _candidates = new List<Lot>();
        private readonly int[] _total;
        private readonly int[] _vacant;

        public DeterministicRandom Rng { get; private set; }

        public CityGrowth(CityMap city, CityGrowthConfig cfg, ulong rngState)
        {
            _city = city ?? throw new ArgumentNullException(nameof(city));
            _cfg = cfg ?? throw new ArgumentNullException(nameof(cfg));
            Rng = new DeterministicRandom(rngState);
            int districts = Enum.GetValues(typeof(District)).Length;
            _total = new int[districts];
            _vacant = new int[districts];
        }

        /// <summary>Avança as obras em andamento em 1 hora. Retorna os terrenos cujas obras terminaram.</summary>
        public void TickHour(List<Lot> completed)
        {
            foreach (var lot in _city.Lots)
            {
                if (!lot.IsUnderDevelopment) continue;
                lot.DevelopmentHoursLeft--;
                if (lot.DevelopmentHoursLeft == 0) completed.Add(lot);
            }
        }

        /// <summary>Executado na virada do dia: talvez inicia um novo empreendimento. Retorna o terreno ou null.</summary>
        public Lot TryStartDevelopment(CityStats stats)
        {
            if (!_cfg.Enabled || !Rng.Chance(_cfg.DailyDevelopmentChance)) return null;

            Array.Clear(_total, 0, _total.Length);
            Array.Clear(_vacant, 0, _vacant.Length);
            foreach (var lot in _city.Lots)
            {
                if (lot.District == District.Park) continue;
                _total[(int)lot.District]++;
                if (lot.IsForSale) _vacant[(int)lot.District]++;
            }

            bool wantHomes = stats.Jobs > stats.Residents * 0.6;
            _candidates.Clear();
            foreach (var lot in _city.Lots)
            {
                if (!lot.IsForSale) continue;
                int d = (int)lot.District;
                // Respeita a reserva mínima de terrenos vagos por zona.
                if (_vacant[d] - 1 < Math.Ceiling(_total[d] * _cfg.MinVacantFraction)) continue;
                _candidates.Add(lot);
                bool preferred = wantHomes ? lot.District == District.Residential : lot.District != District.Residential;
                if (preferred) _candidates.Add(lot); // peso dobrado para a zona demandada
            }
            if (_candidates.Count == 0) return null;

            var chosen = _candidates[Rng.Range(0, _candidates.Count)];
            AmbientRules.Pick(chosen.District, Rng, out var type, out int floors);
            chosen.Ambient = type;
            chosen.AmbientFloors = floors;
            chosen.DevelopmentHoursLeft = _cfg.DevelopmentHours;
            return chosen;
        }
    }
}
