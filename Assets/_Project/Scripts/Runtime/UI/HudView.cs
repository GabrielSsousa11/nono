using EmpireTycoon.Runtime.Quality;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Session;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Barra superior: empresa, caixa, custos diários, data, velocidade e qualidade gráfica.</summary>
    public sealed class HudView
    {
        private readonly GameSession _session;
        private readonly QualityPresetManager _quality;
        private readonly Text _company;
        private readonly Text _cash;
        private readonly Text _upkeep;
        private readonly Text _date;
        private readonly Text _assets;
        private readonly UIFactory.ButtonHandle[] _speedButtons = new UIFactory.ButtonHandle[4];
        private readonly UIFactory.ButtonHandle _qualityButton;
        private long _lastCash = long.MinValue;
        private long _lastTick = -1;

        private static readonly GameSpeed[] Speeds = { GameSpeed.Paused, GameSpeed.Normal, GameSpeed.Fast, GameSpeed.VeryFast };
        private static readonly string[] SpeedLabels = { "II", "1x", "3x", "8x" };

        private readonly Text _population;

        public HudView(RectTransform parent, GameSession session, QualityPresetManager quality, System.Action openMenu)
        {
            _session = session;
            _quality = quality;

            var bar = UIFactory.CreatePanel("TopBar", parent, UITheme.PanelBackground);
            var rt = bar.rectTransform;
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(0.5f, 1);
            rt.offsetMin = new Vector2(16, -132);
            rt.offsetMax = new Vector2(-16, -12);
            var layout = UIFactory.AddHorizontalLayout(bar.gameObject, 24f, new RectOffset(28, 20, 10, 10));
            layout.childForceExpandWidth = false;

            // Bloco financeiro.
            var money = UIFactory.CreateRect("Money", bar.transform);
            UIFactory.AddVerticalLayout(money.gameObject, 0f).childAlignment = TextAnchor.MiddleLeft;
            UIFactory.SetLayout(money, preferredWidth: 360f, flexibleWidth: 0f);
            _company = UIFactory.CreateText("Company", money, session.Player.Name, UITheme.FontSmall, UITheme.TextSecondary);
            _cash = UIFactory.CreateText("Cash", money, "", UITheme.FontLarge, UITheme.TextPrimary, TextAnchor.MiddleLeft, FontStyle.Bold);

            var stats = UIFactory.CreateRect("Stats", bar.transform);
            UIFactory.AddVerticalLayout(stats.gameObject, 2f).childAlignment = TextAnchor.MiddleLeft;
            UIFactory.SetLayout(stats, flexibleWidth: 1f);
            _upkeep = UIFactory.CreateText("Upkeep", stats, "", UITheme.FontSmall, UITheme.TextSecondary);
            _assets = UIFactory.CreateText("Assets", stats, "", UITheme.FontSmall, UITheme.TextSecondary);
            _population = UIFactory.CreateText("Population", stats, "", UITheme.FontSmall, UITheme.TextSecondary);
            foreach (var line in new[] { _upkeep, _assets, _population }) line.horizontalOverflow = HorizontalWrapMode.Overflow;

            _date = UIFactory.CreateText("Date", bar.transform, "", UITheme.FontSmall, UITheme.TextPrimary, TextAnchor.MiddleCenter);
            UIFactory.SetLayout(_date, preferredWidth: 300f, flexibleWidth: 0f);

            var speeds = UIFactory.CreateRect("Speeds", bar.transform);
            UIFactory.AddHorizontalLayout(speeds.gameObject, 8f);
            UIFactory.SetLayout(speeds, preferredWidth: 4 * 80f + 24f, flexibleWidth: 0f);
            for (int i = 0; i < Speeds.Length; i++)
            {
                var speed = Speeds[i];
                _speedButtons[i] = UIFactory.CreateButton("Speed_" + speed, speeds, SpeedLabels[i], UITheme.ButtonSecondary, () => SetSpeed(speed));
            }

            _qualityButton = UIFactory.CreateButton("Quality", bar.transform, "", UITheme.ButtonSecondary, CycleQuality, UITheme.FontSmall);
            UIFactory.SetLayout(_qualityButton.Background, preferredWidth: 200f, flexibleWidth: 0f);
            var menu = UIFactory.CreateButton("Menu", bar.transform, "Menu", UITheme.ButtonPrimary, () => openMenu());
            UIFactory.SetLayout(menu.Background, preferredWidth: 140f, flexibleWidth: 0f);

            RefreshSpeedButtons();
            RefreshQualityLabel();
        }

        public void SetSpeed(GameSpeed speed)
        {
            _session.Clock.Speed = speed;
            RefreshSpeedButtons();
        }

        public void TogglePause()
        {
            SetSpeed(_session.Clock.Speed == GameSpeed.Paused ? GameSpeed.Normal : GameSpeed.Paused);
        }

        private void CycleQuality()
        {
            _quality.Apply(QualityPresetManager.Next(_quality.Current));
            RefreshQualityLabel();
        }

        private void RefreshQualityLabel()
        {
            _qualityButton.Label.text = "Gráficos: " + QualityPresetManager.DisplayName(_quality.Current);
        }

        private void RefreshSpeedButtons()
        {
            for (int i = 0; i < Speeds.Length; i++)
                _speedButtons[i].SetColor(Speeds[i] == _session.Clock.Speed ? UITheme.ButtonActive : UITheme.ButtonSecondary);
        }

        /// <summary>Atualiza textos apenas quando os valores mudam (evita alocação de strings a cada frame).</summary>
        public void Refresh(bool force = false)
        {
            var player = _session.Player;
            if (force || player.Cash.Cents != _lastCash)
            {
                _lastCash = player.Cash.Cents;
                _cash.text = UIStrings.FormatMoney(player.Cash);
                _cash.color = player.Cash.IsNegative ? UITheme.TextNegative : UITheme.TextPrimary;
            }

            if (force || _session.Clock.TotalTicks != _lastTick)
            {
                _lastTick = _session.Clock.TotalTicks;
                _date.text = _session.Clock.FormatDate();

                var upkeep = _session.DailyUpkeep(player.Id);
                var last = player.Ledger.LastCompleteDay;
                string net = last == null ? "" : "  ·  Ontem: " + UIFactory.Colorize(UIStrings.FormatMoneyShort(last.Net),
                    last.Net.IsNegative ? UITheme.TextNegative : UITheme.TextPositive);
                _upkeep.text = "Custos/dia: " + UIStrings.FormatMoneyShort(upkeep) + net;

                int lots = 0, buildings = 0;
                foreach (var lot in _session.City.Lots) if (lot.OwnerId == player.Id) lots++;
                foreach (var b in _session.Buildings) if (b.OwnerId == player.Id) buildings++;
                _assets.text = lots + (lots == 1 ? " terreno" : " terrenos") + "  ·  " + buildings + (buildings == 1 ? " estabelecimento" : " estabelecimentos");
                var stats = _session.Stats;
                _population.text = UIStrings.Number(stats.Residents) + " moradores  ·  " + UIStrings.Number(stats.Jobs) + " empregos";
            }
        }
    }
}
