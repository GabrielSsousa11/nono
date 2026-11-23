using UnityEngine;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Tokens visuais da interface (cores, tamanhos). Mudanças de estilo começam aqui.</summary>
    public static class UITheme
    {
        public static readonly Color PanelBackground = new Color(0.09f, 0.11f, 0.16f, 0.92f);
        public static readonly Color PanelBackgroundLight = new Color(0.15f, 0.18f, 0.25f, 0.95f);
        public static readonly Color CardBackground = new Color(0.19f, 0.22f, 0.3f, 1f);
        public static readonly Color Overlay = new Color(0f, 0f, 0f, 0.55f);

        public static readonly Color TextPrimary = new Color(0.96f, 0.97f, 1f);
        public static readonly Color TextSecondary = new Color(0.68f, 0.73f, 0.82f);
        public static readonly Color TextPositive = new Color(0.45f, 0.9f, 0.55f);
        public static readonly Color TextNegative = new Color(1f, 0.45f, 0.42f);
        public static readonly Color TextWarning = new Color(1f, 0.8f, 0.35f);

        public static readonly Color ButtonPrimary = new Color(0.16f, 0.47f, 0.95f);
        public static readonly Color ButtonSecondary = new Color(0.27f, 0.31f, 0.4f);
        public static readonly Color ButtonDanger = new Color(0.82f, 0.27f, 0.25f);
        public static readonly Color ButtonSuccess = new Color(0.18f, 0.66f, 0.4f);
        public static readonly Color ButtonDisabled = new Color(0.25f, 0.27f, 0.31f);
        public static readonly Color ButtonActive = new Color(0.98f, 0.72f, 0.15f);

        public const int FontSmall = 24;
        public const int FontBody = 28;
        public const int FontTitle = 36;
        public const int FontLarge = 44;

        public const float Padding = 20f;
        public const float ButtonHeight = 84f;
        public const float CornerRadius = 18f;
    }
}
