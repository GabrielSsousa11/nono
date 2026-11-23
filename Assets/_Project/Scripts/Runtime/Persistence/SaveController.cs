using System;
using System.IO;
using EmpireTycoon.Simulation.SaveSystem;
using EmpireTycoon.Simulation.Session;
using UnityEngine;

namespace EmpireTycoon.Runtime.Persistence
{
    /// <summary>
    /// Ponte entre o jogo (Unity) e o <see cref="SaveStorage"/> (C# puro).
    /// Slots: "autosave" (automático) e "manual" (botão Salvar). Saves ficam em
    /// <c>Application.persistentDataPath/saves</c>; a nuvem será uma camada opcional futura.
    /// </summary>
    public sealed class SaveController
    {
        public const string AutoSlot = "autosave";
        public const string ManualSlot = "manual";

        private readonly SaveStorage _storage;

        public SaveController(string directory = null)
        {
            _storage = new SaveStorage(directory ?? Path.Combine(Application.persistentDataPath, "saves"));
        }

        public string Directory => _storage.Directory;

        public static long NowUnixMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        /// <summary>Salva sem lançar exceção; retorna a mensagem de erro (ou null em caso de sucesso).</summary>
        public string TrySave(GameSession session, string slot)
        {
            if (session == null) return "Nenhuma partida em andamento.";
            try
            {
                _storage.Save(slot, session.CreateSnapshot(NowUnixMs()));
                return null;
            }
            catch (SaveException e)
            {
                Debug.LogWarning("[EmpireTycoon] Falha ao salvar '" + slot + "': " + e.Message);
                return e.Message;
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                return "Erro inesperado ao salvar.";
            }
        }

        public SaveLoadResult Load(string slot) => _storage.Load(slot);

        public SaveSummary Peek(string slot)
        {
            try { return _storage.PeekSummary(slot); }
            catch (Exception e) { Debug.LogException(e); return null; }
        }

        /// <summary>O save mais recente entre automático e manual (para o botão "Continuar").</summary>
        public SaveSummary MostRecent()
        {
            var auto = Peek(AutoSlot);
            var manual = Peek(ManualSlot);
            if (auto == null) return manual;
            if (manual == null) return auto;
            return manual.SavedAtUnixMs > auto.SavedAtUnixMs ? manual : auto;
        }
    }
}
