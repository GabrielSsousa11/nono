using System;
using System.Globalization;

namespace EmpireTycoon.Simulation.Core
{
    /// <summary>
    /// Valor monetário em centavos (inteiro de 64 bits).
    /// Usar inteiros evita erros de arredondamento acumulados de ponto flutuante,
    /// que são uma fonte clássica de exploits econômicos (dinheiro "surgindo" do nada).
    /// </summary>
    [Serializable]
    public readonly struct Money : IEquatable<Money>, IComparable<Money>
    {
        public readonly long Cents;

        public static readonly Money Zero = new Money(0);

        public Money(long cents) { Cents = cents; }

        public static Money FromUnits(long units) => new Money(checked(units * 100));

        /// <summary>Converte um valor decimal arredondando para o centavo mais próximo (meio para longe de zero).</summary>
        public static Money FromDecimal(double units)
        {
            if (double.IsNaN(units) || double.IsInfinity(units))
                throw new ArgumentOutOfRangeException(nameof(units), "Valor monetário inválido.");
            return new Money((long)Math.Round(units * 100.0, MidpointRounding.AwayFromZero));
        }

        public double ToDecimal() => Cents / 100.0;

        public bool IsNegative => Cents < 0;
        public bool IsZero => Cents == 0;

        /// <summary>Multiplica por um fator e arredonda para o centavo mais próximo.</summary>
        public Money Scale(double factor)
        {
            if (double.IsNaN(factor) || double.IsInfinity(factor))
                throw new ArgumentOutOfRangeException(nameof(factor));
            return new Money((long)Math.Round(Cents * factor, MidpointRounding.AwayFromZero));
        }

        public static Money operator +(Money a, Money b) => new Money(checked(a.Cents + b.Cents));
        public static Money operator -(Money a, Money b) => new Money(checked(a.Cents - b.Cents));
        public static Money operator -(Money a) => new Money(checked(-a.Cents));
        public static Money operator *(Money a, long n) => new Money(checked(a.Cents * n));
        public static bool operator ==(Money a, Money b) => a.Cents == b.Cents;
        public static bool operator !=(Money a, Money b) => a.Cents != b.Cents;
        public static bool operator <(Money a, Money b) => a.Cents < b.Cents;
        public static bool operator >(Money a, Money b) => a.Cents > b.Cents;
        public static bool operator <=(Money a, Money b) => a.Cents <= b.Cents;
        public static bool operator >=(Money a, Money b) => a.Cents >= b.Cents;

        public static Money Max(Money a, Money b) => a >= b ? a : b;
        public static Money Min(Money a, Money b) => a <= b ? a : b;

        public bool Equals(Money other) => Cents == other.Cents;
        public override bool Equals(object obj) => obj is Money m && Equals(m);
        public override int GetHashCode() => Cents.GetHashCode();
        public int CompareTo(Money other) => Cents.CompareTo(other.Cents);

        /// <summary>Formato completo, ex.: "$ 1.234.567,89".</summary>
        public override string ToString() => Format(this);

        /// <summary>Formato completo no padrão brasileiro, ex.: "$ 1.234.567,89". Independe da cultura do aparelho.</summary>
        public static string Format(Money value)
        {
            string sign = value.Cents < 0 ? "-" : string.Empty;
            ulong abs = value.Cents < 0 ? (ulong)(-(value.Cents + 1)) + 1UL : (ulong)value.Cents;
            return sign + "$ " + GroupThousands(abs / 100UL) + "," + (abs % 100UL).ToString("00", CultureInfo.InvariantCulture);
        }

        /// <summary>Formato compacto para HUD, ex.: "$ 1,23 mi".</summary>
        public static string FormatCompact(Money value)
        {
            string sign = value.Cents < 0 ? "-" : string.Empty;
            ulong abs = value.Cents < 0 ? (ulong)(-(value.Cents + 1)) + 1UL : (ulong)value.Cents;
            ulong units = abs / 100UL;
            if (units >= 1_000_000_000UL) return sign + "$ " + Decimal2(abs, 100_000_000_000UL) + " bi";
            if (units >= 1_000_000UL) return sign + "$ " + Decimal2(abs, 100_000_000UL) + " mi";
            if (units >= 10_000UL) return sign + "$ " + Decimal2(abs, 100_000UL) + " mil";
            return sign + "$ " + GroupThousands(units);
        }

        private static string GroupThousands(ulong units)
        {
            string digits = units.ToString(CultureInfo.InvariantCulture);
            var sb = new System.Text.StringBuilder(digits.Length + digits.Length / 3);
            int firstGroup = digits.Length % 3;
            for (int i = 0; i < digits.Length; i++)
            {
                if (i > 0 && (i - firstGroup) % 3 == 0) sb.Append('.');
                sb.Append(digits[i]);
            }
            return sb.ToString();
        }

        /// <summary>Divide e formata com até 2 casas decimais (truncado), separador vírgula, sem zeros à direita.</summary>
        private static string Decimal2(ulong cents, ulong divisorCents)
        {
            ulong whole = cents / divisorCents;
            ulong frac = cents % divisorCents * 100UL / divisorCents;
            string result = whole.ToString(CultureInfo.InvariantCulture);
            if (frac == 0) return result;
            string f = frac.ToString("00", CultureInfo.InvariantCulture).TrimEnd('0');
            return result + "," + f;
        }
    }
}
