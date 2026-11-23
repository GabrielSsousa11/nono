using System;

namespace EmpireTycoon.Simulation.Core
{
    public enum GameSpeed
    {
        Paused = 0,
        Normal = 1,
        Fast = 2,
        VeryFast = 3,
    }

    /// <summary>
    /// Relógio da simulação. Um "tick" equivale a 1 hora de jogo. A simulação econômica
    /// avança em ticks discretos (independente do frame rate), com limite de ticks por
    /// atualização para evitar a "espiral da morte" em aparelhos lentos.
    /// </summary>
    public sealed class SimulationClock
    {
        public const int HoursPerDay = 24;
        public const int DaysPerMonth = 30;
        public const int MonthsPerYear = 12;

        private readonly double _secondsPerTick;
        private readonly int _maxTicksPerAdvance;
        private double _accumulator;

        public SimulationClock(double secondsPerTickAtNormalSpeed, int maxTicksPerAdvance, long startTick = 0)
        {
            if (secondsPerTickAtNormalSpeed <= 0) throw new ArgumentOutOfRangeException(nameof(secondsPerTickAtNormalSpeed));
            if (maxTicksPerAdvance <= 0) throw new ArgumentOutOfRangeException(nameof(maxTicksPerAdvance));
            _secondsPerTick = secondsPerTickAtNormalSpeed;
            _maxTicksPerAdvance = maxTicksPerAdvance;
            TotalTicks = startTick;
            Speed = GameSpeed.Normal;
        }

        public long TotalTicks { get; private set; }
        public GameSpeed Speed { get; set; }

        public int Hour => (int)(TotalTicks % HoursPerDay);
        public long TotalDays => TotalTicks / HoursPerDay;
        public int DayOfMonth => (int)(TotalDays % DaysPerMonth) + 1;
        public int Month => (int)(TotalDays / DaysPerMonth % MonthsPerYear) + 1;
        public int Year => (int)(TotalDays / (DaysPerMonth * MonthsPerYear)) + 1;

        /// <summary>Fração [0,1) entre o tick atual e o próximo (útil para interpolação visual).</summary>
        public float TickProgress => (float)(_accumulator / _secondsPerTick);

        public static double SpeedMultiplier(GameSpeed speed)
        {
            switch (speed)
            {
                case GameSpeed.Paused: return 0;
                case GameSpeed.Normal: return 1;
                case GameSpeed.Fast: return 3;
                case GameSpeed.VeryFast: return 8;
                default: return 1;
            }
        }

        /// <summary>
        /// Acumula tempo real e retorna quantos ticks devem ser simulados agora.
        /// O tempo excedente além do limite é descartado (o jogo desacelera em vez de travar).
        /// </summary>
        public int Advance(double realDeltaSeconds)
        {
            if (realDeltaSeconds <= 0 || Speed == GameSpeed.Paused) return 0;
            _accumulator += realDeltaSeconds * SpeedMultiplier(Speed);
            int ticks = (int)Math.Floor(_accumulator / _secondsPerTick);
            if (ticks > _maxTicksPerAdvance)
            {
                ticks = _maxTicksPerAdvance;
                _accumulator = 0;
            }
            else
            {
                _accumulator -= ticks * _secondsPerTick;
            }
            return ticks;
        }

        /// <summary>Marca um tick como processado.</summary>
        public void CommitTick() => TotalTicks++;

        public string FormatDate() => "Dia " + DayOfMonth.ToString("00") + "/" + Month.ToString("00") + " · Ano " + Year + " · " + Hour.ToString("00") + ":00";
    }
}
