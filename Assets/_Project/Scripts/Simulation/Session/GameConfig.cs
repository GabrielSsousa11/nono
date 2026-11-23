using System;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Economy;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.Session
{
    /// <summary>Configuração completa de uma nova partida.</summary>
    [Serializable]
    public sealed class GameConfig
    {
        public string PlayerCompanyName = "Empire Holdings";
        public long StartingCashUnits = 250_000;

        /// <summary>Segundos reais por hora de jogo na velocidade normal.</summary>
        public double SecondsPerTick = 0.5;
        public int MaxTicksPerFrame = 12;

        /// <summary>Hora do dia em que a partida começa.</summary>
        public int StartHour = 8;

        public CityLayoutConfig City = new CityLayoutConfig();
        public EconomyConfig Economy = new EconomyConfig();

        public Money StartingCash => Money.FromUnits(StartingCashUnits);

        public void Validate()
        {
            if (StartingCashUnits <= 0) throw new InvalidOperationException("Capital inicial deve ser positivo.");
            if (SecondsPerTick <= 0) throw new InvalidOperationException("SecondsPerTick deve ser positivo.");
            if (MaxTicksPerFrame <= 0) throw new InvalidOperationException("MaxTicksPerFrame deve ser positivo.");
            if (StartHour < 0 || StartHour >= SimulationClock.HoursPerDay) throw new InvalidOperationException("StartHour inválida.");
            if (City == null || Economy == null) throw new InvalidOperationException("Configuração incompleta.");
            City.Validate();
            Economy.Validate();
        }
    }
}
