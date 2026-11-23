using System;
using System.Collections.Generic;

namespace EmpireTycoon.Simulation.Core
{
    /// <summary>
    /// Barramento de eventos tipado e síncrono. A simulação publica eventos de domínio;
    /// a camada visual (Unity) e a UI apenas assinam, sem que a simulação as conheça.
    /// </summary>
    public sealed class EventBus
    {
        private readonly Dictionary<Type, List<Delegate>> _handlers = new Dictionary<Type, List<Delegate>>();

        public IDisposable Subscribe<T>(Action<T> handler)
        {
            if (handler == null) throw new ArgumentNullException(nameof(handler));
            if (!_handlers.TryGetValue(typeof(T), out var list))
            {
                list = new List<Delegate>();
                _handlers[typeof(T)] = list;
            }
            list.Add(handler);
            return new Subscription(() => Unsubscribe(handler));
        }

        public void Unsubscribe<T>(Action<T> handler)
        {
            if (_handlers.TryGetValue(typeof(T), out var list)) list.Remove(handler);
        }

        public void Publish<T>(T evt)
        {
            if (!_handlers.TryGetValue(typeof(T), out var list) || list.Count == 0) return;
            // Cópia defensiva: handlers podem (des)assinar durante a publicação.
            var snapshot = list.ToArray();
            for (int i = 0; i < snapshot.Length; i++) ((Action<T>)snapshot[i])(evt);
        }

        public int HandlerCount<T>() => _handlers.TryGetValue(typeof(T), out var list) ? list.Count : 0;

        private sealed class Subscription : IDisposable
        {
            private Action _dispose;
            public Subscription(Action dispose) { _dispose = dispose; }
            public void Dispose() { _dispose?.Invoke(); _dispose = null; }
        }
    }
}
