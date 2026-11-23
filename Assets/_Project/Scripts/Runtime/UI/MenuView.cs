using System;
using EmpireTycoon.Runtime.Persistence;
using EmpireTycoon.Runtime.Quality;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.SaveSystem;
using EmpireTycoon.Simulation.Session;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Tela inicial (continuar/novo jogo) e menu de pausa (salvar/carregar/novo jogo/sair).</summary>
    public sealed class MenuView
    {
        private readonly GameSession _session;
        private readonly IGameFlow _flow;
        private readonly QualityPresetManager _quality;
        private ConfirmDialog _dialog;
        private readonly ToastView _toasts;

        private readonly GameObject _title;
        private readonly UIFactory.ButtonHandle _continue;
        private readonly UIFactory.ButtonHandle _titleQuality;

        private readonly GameObject _pause;
        private readonly RectTransform _pauseButtons;
        private GameSpeed _speedBeforePause = GameSpeed.Normal;

        public bool IsTitleOpen => _title.activeSelf;
        public bool IsPauseOpen => _pause.activeSelf;

        public MenuView(Transform canvas, GameSession session, IGameFlow flow, QualityPresetManager quality, ConfirmDialog dialog, ToastView toasts)
        {
            _session = session;
            _flow = flow;
            _quality = quality;
            _dialog = dialog;
            _toasts = toasts;

            // ---------------- Tela inicial
            var title = UIFactory.CreatePanel("TitleScreen", canvas, new Color(0.04f, 0.06f, 0.1f, 0.55f), rounded: false);
            UIFactory.Stretch(title.rectTransform);
            title.raycastTarget = true;
            _title = title.gameObject;

            var column = UIFactory.CreatePanel("Column", title.transform, UITheme.PanelBackground);
            column.rectTransform.anchorMin = column.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            column.rectTransform.sizeDelta = new Vector2(820f, 0f);
            UIFactory.AddVerticalLayout(column.gameObject, 22f, new RectOffset(48, 48, 44, 40));
            column.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            UIFactory.CreateText("Logo", column.transform, "EMPIRE TYCOON", 84, UITheme.ButtonActive, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIFactory.CreateText("Tagline", column.transform, "Do primeiro terreno ao conglomerado internacional", UITheme.FontBody, UITheme.TextSecondary, TextAnchor.MiddleCenter);
            var spacer = UIFactory.CreateRect("Spacer", column.transform);
            UIFactory.SetLayout(spacer, preferredHeight: 10f);

            _continue = UIFactory.CreateButton("Continue", column.transform, "Continuar", UITheme.ButtonPrimary, () => Load(SaveController.AutoSlot, fromTitle: true));
            UIFactory.SetLayout(_continue.Background, preferredHeight: 120f);
            UIFactory.CreateButton("NewGame", column.transform, "Novo jogo", UITheme.ButtonSuccess, ConfirmNewGame);
            _titleQuality = UIFactory.CreateButton("Quality", column.transform, "", UITheme.ButtonSecondary, CycleQuality, UITheme.FontSmall);
            UIFactory.CreateText("Version", column.transform, "v" + Application.version + "  ·  Fase 2 (protótipo)", UITheme.FontSmall - 4, UITheme.TextSecondary, TextAnchor.MiddleCenter);
            _title.SetActive(false);

            // ---------------- Menu de pausa
            var pause = UIFactory.CreatePanel("PauseMenu", canvas, UITheme.Overlay, rounded: false);
            UIFactory.Stretch(pause.rectTransform);
            pause.raycastTarget = true;
            _pause = pause.gameObject;

            var box = UIFactory.CreatePanel("Box", pause.transform, UITheme.PanelBackgroundLight);
            box.rectTransform.anchorMin = box.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            box.rectTransform.sizeDelta = new Vector2(760f, 0f);
            UIFactory.AddVerticalLayout(box.gameObject, 16f, new RectOffset(40, 40, 32, 36));
            box.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            UIFactory.CreateText("Title", box.transform, "Jogo pausado", UITheme.FontTitle, UITheme.TextPrimary, TextAnchor.MiddleCenter, FontStyle.Bold);
            _pauseButtons = UIFactory.CreateRect("Buttons", box.transform);
            UIFactory.AddVerticalLayout(_pauseButtons.gameObject, 14f);
            _pause.SetActive(false);
        }

        public void SetDialog(ConfirmDialog dialog) => _dialog = dialog;

        // ------------------------------------------------------------------ Tela inicial

        public void HideTitle() => _title.SetActive(false);

        public void ShowTitle()
        {
            _session.Clock.Speed = GameSpeed.Paused;
            var recent = _flow.MostRecentSave();
            _continue.SetInteractable(recent != null);
            _continue.Label.text = recent != null
                ? "Continuar\n" + UIFactory.Colorize(Describe(recent), UITheme.TextSecondary)
                : "Continuar\n" + UIFactory.Colorize("nenhum jogo salvo", UITheme.TextSecondary);
            if (recent != null)
            {
                _continue.Button.onClick.RemoveAllListeners();
                string slot = recent.Slot;
                _continue.Button.onClick.AddListener(() => Load(slot, fromTitle: true));
            }
            RefreshQualityLabel();
            _title.transform.SetAsLastSibling();
            _title.SetActive(true);
        }

        private void ConfirmNewGame()
        {
            bool fromTitle = IsTitleOpen;
            if (_flow.MostRecentSave() == null)
            {
                _flow.StartNewGame();
                return;
            }
            _dialog.Show("Começar um novo jogo?",
                fromTitle
                    ? "O salvamento automático será substituído pela nova partida. O jogo salvo manualmente continua disponível."
                    : "O progresso não salvo desta partida será perdido. O jogo salvo manualmente continua disponível.",
                "Novo jogo", UITheme.ButtonSuccess, _flow.StartNewGame);
        }

        private void CycleQuality()
        {
            _quality.Apply(QualityPresetManager.Next(_quality.Current));
            RefreshQualityLabel();
        }

        private void RefreshQualityLabel()
        {
            _titleQuality.Label.text = "Gráficos: " + QualityPresetManager.DisplayName(_quality.Current);
        }

        // ------------------------------------------------------------------ Pausa

        public void OpenPause()
        {
            if (IsTitleOpen || IsPauseOpen) return;
            _speedBeforePause = _session.Clock.Speed == GameSpeed.Paused ? GameSpeed.Normal : _session.Clock.Speed;
            _session.Clock.Speed = GameSpeed.Paused;
            RebuildPauseButtons();
            _pause.transform.SetAsLastSibling();
            _pause.SetActive(true);
        }

        public void ClosePause()
        {
            if (!IsPauseOpen) return;
            _pause.SetActive(false);
            _session.Clock.Speed = _speedBeforePause;
        }

        private void RebuildPauseButtons()
        {
            UIFactory.ClearChildren(_pauseButtons);
            UIFactory.CreateButton("Resume", _pauseButtons, "Retomar", UITheme.ButtonPrimary, ClosePause);

            var manual = _flow.PeekSave(SaveController.ManualSlot);
            UIFactory.CreateButton("Save", _pauseButtons, "Salvar jogo" + SubLine(manual, "sobrescreve: "), UITheme.ButtonSuccess, () =>
            {
                string error = _flow.SaveGame(SaveController.ManualSlot);
                if (error == null) _toasts.Show("Jogo salvo.", ToastKind.Success);
                else _toasts.Show("Não foi possível salvar: " + error, ToastKind.Error);
                RebuildPauseButtons();
            });

            var loadManual = UIFactory.CreateButton("LoadManual", _pauseButtons, "Carregar jogo salvo" + SubLine(manual, ""), UITheme.ButtonSecondary,
                () => ConfirmLoad(SaveController.ManualSlot));
            loadManual.SetInteractable(manual != null);
            UIFactory.SetLayout(loadManual.Background, preferredHeight: 110f);

            var auto = _flow.PeekSave(SaveController.AutoSlot);
            var loadAuto = UIFactory.CreateButton("LoadAuto", _pauseButtons, "Carregar salvamento automático" + SubLine(auto, ""), UITheme.ButtonSecondary,
                () => ConfirmLoad(SaveController.AutoSlot));
            loadAuto.SetInteractable(auto != null);
            UIFactory.SetLayout(loadAuto.Background, preferredHeight: 110f);

            UIFactory.CreateButton("NewGame", _pauseButtons, "Novo jogo", UITheme.ButtonSecondary, ConfirmNewGame);
            UIFactory.CreateButton("Quit", _pauseButtons, "Salvar e sair", UITheme.ButtonDanger, _flow.QuitGame);
        }

        private void ConfirmLoad(string slot)
        {
            _dialog.Show("Carregar jogo?", "O progresso desde o último salvamento será perdido.", "Carregar", UITheme.ButtonPrimary,
                () => Load(slot, fromTitle: false));
        }

        private void Load(string slot, bool fromTitle)
        {
            string error = _flow.LoadGame(slot);
            if (error != null) _toasts.Show("Não foi possível carregar: " + error, ToastKind.Error);
            // Em caso de sucesso, a interface inteira é recriada pelo bootstrap.
        }

        // ------------------------------------------------------------------ Formatação

        private static string SubLine(SaveSummary s, string prefix) =>
            s == null ? "" : "\n" + UIFactory.Colorize(prefix + Describe(s), UITheme.TextSecondary);

        public static string Describe(SaveSummary s)
        {
            string backup = s.FromBackup ? " (backup)" : "";
            return s.CompanyName + " · " + SimulationClock.FormatDate(s.TotalTicks, includeHour: false) + " · " +
                   Money.FormatCompact(new Money(s.CashCents)) + " · " + Ago(s.SavedAtUnixMs) + backup;
        }

        private static string Ago(long unixMs)
        {
            var span = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeMilliseconds(unixMs);
            if (span.TotalMinutes < 1) return "agora";
            if (span.TotalHours < 1) return "há " + (int)span.TotalMinutes + " min";
            if (span.TotalDays < 1) return "há " + (int)span.TotalHours + " h";
            return "há " + (int)span.TotalDays + (span.TotalDays < 2 ? " dia" : " dias");
        }
    }
}
