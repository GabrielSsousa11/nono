using EmpireTycoon.Simulation.Core;
using NUnit.Framework;

namespace EmpireTycoon.Tests
{
    public class CoreTests
    {
        [Test]
        public void Random_IsDeterministic()
        {
            var a = new DeterministicRandom(42);
            var b = new DeterministicRandom(42);
            for (int i = 0; i < 100; i++) Assert.AreEqual(a.NextULong(), b.NextULong());
        }

        [Test]
        public void Random_RangeStaysInBounds()
        {
            var r = new DeterministicRandom(7);
            for (int i = 0; i < 10000; i++)
            {
                int v = r.Range(-3, 5);
                Assert.That(v, Is.InRange(-3, 4));
                double d = r.NextDouble();
                Assert.That(d, Is.GreaterThanOrEqualTo(0).And.LessThan(1));
            }
        }

        [Test]
        public void EventBus_PublishesToSubscribers_AndUnsubscribes()
        {
            var bus = new EventBus();
            int received = 0;
            var sub = bus.Subscribe<int>(v => received += v);
            bus.Publish(5);
            sub.Dispose();
            bus.Publish(5);
            Assert.AreEqual(5, received);
            Assert.AreEqual(0, bus.HandlerCount<int>());
        }

        [Test]
        public void EventBus_AllowsUnsubscribeDuringPublish()
        {
            var bus = new EventBus();
            System.IDisposable sub = null;
            int calls = 0;
            sub = bus.Subscribe<string>(_ => { calls++; sub.Dispose(); });
            bus.Publish("a");
            bus.Publish("b");
            Assert.AreEqual(1, calls);
        }

        [Test]
        public void Clock_ConvertsRealTimeToTicks()
        {
            var clock = new SimulationClock(0.5, 100);
            Assert.AreEqual(2, clock.Advance(1.0));
            Assert.AreEqual(0, clock.Advance(0.25));
            Assert.AreEqual(1, clock.Advance(0.25));
        }

        [Test]
        public void Clock_RespectsSpeedAndPause()
        {
            var clock = new SimulationClock(1.0, 100) { Speed = GameSpeed.Fast };
            Assert.AreEqual(3, clock.Advance(1.0));
            clock.Speed = GameSpeed.Paused;
            Assert.AreEqual(0, clock.Advance(10.0));
        }

        [Test]
        public void Clock_CapsTicksPerAdvance_AndDropsBacklog()
        {
            var clock = new SimulationClock(0.1, 5);
            Assert.AreEqual(5, clock.Advance(60.0)); // ex.: app voltou de segundo plano
            Assert.AreEqual(0, clock.Advance(0.05));
        }

        [Test]
        public void Clock_CalendarRollsOver()
        {
            var clock = new SimulationClock(1, 1, startTick: 23);
            Assert.AreEqual(23, clock.Hour);
            clock.CommitTick();
            Assert.AreEqual(0, clock.Hour);
            Assert.AreEqual(2, clock.DayOfMonth);
            Assert.AreEqual(1, clock.Month);
        }

        [Test]
        public void GridRect_OverlapAndContains()
        {
            var a = new GridRect(0, 0, 3, 3);
            Assert.IsTrue(a.Contains(new GridCoord(2, 2)));
            Assert.IsFalse(a.Contains(new GridCoord(3, 0)));
            Assert.IsTrue(a.Overlaps(new GridRect(2, 2, 2, 2)));
            Assert.IsFalse(a.Overlaps(new GridRect(3, 0, 2, 2)));
        }
    }
}
