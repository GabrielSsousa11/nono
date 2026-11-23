using System;
using System.Collections.Generic;
using EmpireTycoon.Runtime.Data;
using EmpireTycoon.Runtime.Interaction;
using EmpireTycoon.Runtime.Quality;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Session;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Raiz da interface: cria o Canvas e compõe HUD, painel de terreno, diálogos e notificações.</summary>
    public sealed class GameUI : MonoBehaviour
    {
        private GameSession _session;
        private HudView _hud;
        private LotPanelView _lotPanel;
        private ConfirmDialog _dialog;
        private ToastView _toasts;
        private readonly List<IDisposable> _subscriptions = new List<IDisposable>();

        public ToastView Toasts => _toasts;

        public void Initialize(GameSession session, SelectionController selection, GameDatabase db, QualityPresetManager quality)
        {
            _session = session;

            var canvasGo = new GameObject("Canvas", typeof(RectTransform));
            canvasGo.layer = 5;
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            canvas.pixelPerfect = false;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f; // jogo em paisagem: escala pela altura
            canvasGo.AddComponent<GraphicRaycaster>();

            var safe = UIFactory.CreateRect("SafeArea", canvasGo.transform);
            UIFactory.Stretch(safe);
            safe.gameObject.AddComponent<SafeAreaFitter>();

            _toasts = safe.gameObject.AddComponent<ToastView>();
            _hud = new HudView(safe, session, quality);
            _dialog = new ConfirmDialog(canvasGo.transform);
            _lotPanel = new LotPanelView(safe, session, selection, db, _dialog, _toasts);
            _toasts.Initialize(safe);

            _subscriptions.Add(session.Events.Subscribe<BuildingStateChanged>(e =>
            {
                var b = session.GetBuilding(e.BuildingId);
                if (b != null && b.OwnerId == session.Player.Id && b.State == BuildingState.Operational)
                    _toasts.Show("Obra concluída: " + b.Definition.DisplayName + " (nível " + b.Level + ")", ToastKind.Success);
            }));

            _hud.Refresh(force: true);
        }

        /// <summary>Trata o botão "voltar" do Android/Esc. Retorna true se consumiu o evento.</summary>
        public bool HandleBack()
        {
            if (_dialog.IsOpen) { _dialog.Close(); return true; }
            if (_lotPanel.IsOpen) { _lotPanel.CloseOrBack(); return true; }
            return false;
        }

        public void TogglePause() => _hud.TogglePause();

        private void Update()
        {
            if (_session == null) return;
            _hud.Refresh();
            _lotPanel.Update();
        }

        private void OnDestroy()
        {
            foreach (var s in _subscriptions) s.Dispose();
            _subscriptions.Clear();
        }
    }
}
