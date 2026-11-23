using System;
using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.Economy
{
    /// <summary>
    /// Empresa (do jogador ou, a partir da Fase 5, de um concorrente de IA).
    /// Todo movimento de caixa passa por <see cref="TryDebit"/>, <see cref="Charge"/> ou <see cref="Credit"/>
    /// e é registrado no livro-razão — não existe outro caminho para alterar o caixa.
    /// </summary>
    public sealed class Company
    {
        public readonly int Id;
        public readonly string Name;
        public readonly bool IsPlayer;
        public readonly Ledger Ledger = new Ledger();

        public Money Cash { get; private set; }

        public event Action<Company, Money> CashChanged;

        public Company(int id, string name, bool isPlayer)
        {
            Id = id;
            Name = name ?? throw new ArgumentNullException(nameof(name));
            IsPlayer = isPlayer;
        }

        public bool CanAfford(Money amount) => amount.Cents >= 0 && Cash >= amount;

        /// <summary>Gasto voluntário: só ocorre se houver saldo suficiente.</summary>
        public bool TryDebit(Money amount, TransactionCategory category, long tick, string description)
        {
            if (amount.IsNegative) throw new ArgumentOutOfRangeException(nameof(amount));
            if (!CanAfford(amount)) return false;
            Apply(-amount, category, tick, description);
            return true;
        }

        /// <summary>Obrigação (manutenção, impostos): é cobrada mesmo que o caixa fique negativo.</summary>
        public void Charge(Money amount, TransactionCategory category, long tick, string description)
        {
            if (amount.IsNegative) throw new ArgumentOutOfRangeException(nameof(amount));
            if (amount.IsZero) return;
            Apply(-amount, category, tick, description);
        }

        public void Credit(Money amount, TransactionCategory category, long tick, string description)
        {
            if (amount.IsNegative) throw new ArgumentOutOfRangeException(nameof(amount));
            if (amount.IsZero) return;
            Apply(amount, category, tick, description);
        }

        /// <summary>Define o caixa diretamente (somente ao carregar um save; o livro-razão é restaurado junto).</summary>
        internal void RestoreCash(Money cash) => Cash = cash;

        private void Apply(Money delta, TransactionCategory category, long tick, string description)
        {
            Cash += delta;
            Ledger.Record(new Transaction(tick, category, delta, description));
            CashChanged?.Invoke(this, delta);
        }
    }
}
