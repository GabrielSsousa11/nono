using EmpireTycoon.Simulation.SaveSystem;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Operações de fluxo de jogo que a interface pode pedir (implementadas pelo bootstrap).</summary>
    public interface IGameFlow
    {
        SaveSummary PeekSave(string slot);
        SaveSummary MostRecentSave();
        void StartNewGame();

        /// <summary>Carrega um slot. Retorna null em caso de sucesso, ou a mensagem de erro.</summary>
        string LoadGame(string slot);

        /// <summary>Salva no slot. Retorna null em caso de sucesso, ou a mensagem de erro.</summary>
        string SaveGame(string slot);

        void QuitGame();
    }
}
