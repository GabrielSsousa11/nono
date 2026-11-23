using UnityEngine;

namespace EmpireTycoon.Runtime.Quality
{
    public enum QualityPreset
    {
        Low = 0,
        Medium = 1,
        High = 2,
    }

    /// <summary>
    /// Presets gráficos Baixo/Médio/Alto. Cada nível de qualidade da Unity (criado pelo menu
    /// Empire Tycoon &gt; Configurar Projeto) aponta para um URP Asset próprio (escala de render,
    /// sombras, MSAA). Aqui escolhemos o nível e a meta de FPS; a escolha é lembrada entre sessões.
    /// </summary>
    public sealed class QualityPresetManager
    {
        private const string PrefKey = "empire.settings.quality";

        public QualityPreset Current { get; private set; } = QualityPreset.Medium;

        public void Initialize()
        {
            int saved = PlayerPrefs.GetInt(PrefKey, -1);
            var preset = saved >= 0 && saved <= 2 ? (QualityPreset)saved : DetectDefault();
            Apply(preset, save: false);
        }

        /// <summary>Heurística simples por hardware; o jogador pode trocar no HUD.</summary>
        public static QualityPreset DetectDefault()
        {
            if (!Application.isMobilePlatform) return QualityPreset.High;
            int memoryMb = SystemInfo.systemMemorySize;
            int cores = SystemInfo.processorCount;
            if (memoryMb <= 3500 || cores <= 4) return QualityPreset.Low;
            if (memoryMb <= 6500) return QualityPreset.Medium;
            return QualityPreset.High;
        }

        public void Apply(QualityPreset preset, bool save = true)
        {
            Current = preset;
            int index = FindLevel(preset);
            if (index >= 0 && index != QualitySettings.GetQualityLevel())
                QualitySettings.SetQualityLevel(index, applyExpensiveChanges: true);

            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = preset == QualityPreset.High || !Application.isMobilePlatform ? 60 : 30;

            if (save)
            {
                PlayerPrefs.SetInt(PrefKey, (int)preset);
                PlayerPrefs.Save();
            }
        }

        private static int FindLevel(QualityPreset preset)
        {
            string wanted = preset.ToString();
            var names = QualitySettings.names;
            for (int i = 0; i < names.Length; i++)
                if (string.Equals(names[i], wanted, System.StringComparison.OrdinalIgnoreCase)) return i;
            // Projeto não configurado: aproxima pelos níveis existentes.
            if (names.Length == 0) return -1;
            return Mathf.Clamp(Mathf.RoundToInt((int)preset / 2f * (names.Length - 1)), 0, names.Length - 1);
        }

        public static QualityPreset Next(QualityPreset p) => (QualityPreset)(((int)p + 1) % 3);

        public static string DisplayName(QualityPreset p)
        {
            switch (p)
            {
                case QualityPreset.Low: return "Baixo";
                case QualityPreset.Medium: return "Médio";
                default: return "Alto";
            }
        }
    }
}
