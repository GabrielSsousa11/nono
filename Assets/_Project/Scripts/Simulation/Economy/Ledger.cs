using System;
using System.Collections.Generic;
using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.Economy
{
    public readonly struct Transaction
    {
        public readonly long Tick;
        public readonly TransactionCategory Category;
        public readonly Money Amount; // positivo = entrada, negativo = saída
        public readonly string Description;

        public Transaction(long tick, TransactionCategory category, Money amount, string description)
        {
            Tick = tick;
            Category = category;
            Amount = amount;
            Description = description ?? string.Empty;
        }
    }

    /// <summary>Resumo financeiro de um dia de jogo.</summary>
    public sealed class DailyReport
    {
        public long Day;
        public Money Income;
        public Money Expenses; // valor positivo
        public Money Net => Income - Expenses;
    }

    /// <summary>
    /// Livro-razão de uma empresa. Mantém histórico limitado (memória constante em partidas longas)
    /// e totais agregados por categoria.
    /// </summary>
    public sealed class Ledger
    {
        public const int MaxRecentTransactions = 200;
        public const int MaxDailyReports = 60;

        private readonly LinkedList<Transaction> _recent = new LinkedList<Transaction>();
        private readonly LinkedList<DailyReport> _days = new LinkedList<DailyReport>();
        private readonly Dictionary<TransactionCategory, Money> _totals = new Dictionary<TransactionCategory, Money>();

        public IEnumerable<Transaction> Recent => _recent;
        public IEnumerable<DailyReport> DailyReports => _days;
        public int RecentCount => _recent.Count;

        public Money TotalFor(TransactionCategory category) => _totals.TryGetValue(category, out var m) ? m : Money.Zero;

        public DailyReport Today => _days.Last?.Value;

        /// <summary>Relatório do último dia completo (ontem), ou null se ainda não houver.</summary>
        public DailyReport LastCompleteDay => _days.Last?.Previous?.Value;

        public void Record(Transaction t)
        {
            _recent.AddLast(t);
            if (_recent.Count > MaxRecentTransactions) _recent.RemoveFirst();

            _totals[t.Category] = TotalFor(t.Category) + t.Amount;

            long day = t.Tick / SimulationClock.HoursPerDay;
            var report = EnsureDay(day);
            if (t.Amount.IsNegative) report.Expenses += -t.Amount;
            else report.Income += t.Amount;
        }

        public DailyReport EnsureDay(long day)
        {
            var last = _days.Last?.Value;
            if (last != null && last.Day == day) return last;
            if (last != null && day < last.Day)
            {
                // Transação retroativa: procura o dia (raro; mantém consistência).
                for (var node = _days.Last; node != null; node = node.Previous)
                    if (node.Value.Day == day) return node.Value;
                throw new InvalidOperationException("Dia " + day + " fora do histórico do livro-razão.");
            }
            var report = new DailyReport { Day = day };
            _days.AddLast(report);
            if (_days.Count > MaxDailyReports) _days.RemoveFirst();
            return report;
        }
    }
}
