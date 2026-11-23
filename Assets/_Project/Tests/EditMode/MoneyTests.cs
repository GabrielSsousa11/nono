using EmpireTycoon.Simulation.Core;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class MoneyTests
    {
        [Test]
        public void Arithmetic_IsExactInCents()
        {
            var a = Money.FromDecimal(0.1);
            var sum = Money.Zero;
            for (int i = 0; i < 1000; i++) sum += a;
            Assert.AreEqual(Money.FromUnits(100), sum);
        }

        [Test]
        public void Scale_RoundsToNearestCent()
        {
            Assert.AreEqual(334, new Money(1000).Scale(1.0 / 3.0 + 0.0005).Cents);
            Assert.AreEqual(3, new Money(5).Scale(0.5).Cents); // 2,5 → 3 (longe de zero)
        }

        [Test]
        public void Overflow_Throws()
        {
            Assert.Throws<System.OverflowException>(() => { var _ = new Money(long.MaxValue) + new Money(1); });
        }

        [TestCase(0, "$ 0,00")]
        [TestCase(123456789, "$ 1.234.567,89")]
        [TestCase(-150, "-$ 1,50")]
        [TestCase(100000, "$ 1.000,00")]
        public void Format_UsesBrazilianSeparators(long cents, string expected)
        {
            Assert.AreEqual(expected, Money.Format(new Money(cents)));
        }

        [TestCase(99900, "$ 999")]
        [TestCase(2_500_000, "$ 25 mil")]
        [TestCase(123_456_789, "$ 1,23 mi")]
        [TestCase(-300_000_000_000, "-$ 3 bi")]
        public void FormatCompact(long cents, string expected)
        {
            Assert.AreEqual(expected, Money.FormatCompact(new Money(cents)));
        }

        [Test]
        public void Format_HandlesMinValue()
        {
            Assert.DoesNotThrow(() => Money.Format(new Money(long.MinValue)));
        }
    }
}
