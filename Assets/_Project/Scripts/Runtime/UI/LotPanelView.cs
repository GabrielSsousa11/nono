using System;
using EmpireTycoon.Runtime.Data;
using EmpireTycoon.Runtime.Interaction;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>
    /// Painel lateral do terreno selecionado. Mostra informações e as ações válidas para o estado
    /// atual (comprar, vender, construir, melhorar, demolir). Cada botão chama um comando real da
    /// <see cref="GameSession"/>; ações indisponíveis aparecem desabilitadas com o motivo.
    /// </summary>
    public sealed class LotPanelView
    {
        private enum Mode { Details, BuildMenu }

        private readonly GameSession _session;
        private readonly SelectionController _selection;
        private readonly GameDatabase _db;
        private ConfirmDialog _dialog;
        private readonly ToastView _toasts;

        private readonly GameObject _root;
        private readonly Text _title;
        private readonly Text _subtitle;
        private readonly RectTransform _content;
        private readonly ScrollRect _scroll;

        private Mode _mode = Mode.Details;
        private bool _dirty = true;
        private bool _resetScroll = true;
        private Image _progressFill;
        private Text _progressLabel;

        public bool IsOpen => _root.activeSelf;

        public void SetDialog(ConfirmDialog dialog) => _dialog = dialog;

        public LotPanelView(RectTransform parent, GameSession session, SelectionController selection, GameDatabase db, ConfirmDialog dialog, ToastView toasts)
        {
            _session = session;
            _selection = selection;
            _db = db;
            _dialog = dialog;
            _toasts = toasts;

            var panel = UIFactory.CreatePanel("LotPanel", parent, UITheme.PanelBackground);
            panel.raycastTarget = true;
            var rt = panel.rectTransform;
            rt.anchorMin = new Vector2(1, 0);
            rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(1, 0.5f);
            rt.offsetMin = new Vector2(-640f, 16f);
            rt.offsetMax = new Vector2(-16f, -148f);
            _root = panel.gameObject;

            // Cabeçalho.
            var header = UIFactory.CreateRect("Header", panel.transform);
            header.anchorMin = new Vector2(0, 1);
            header.anchorMax = new Vector2(1, 1);
            header.pivot = new Vector2(0.5f, 1);
            header.offsetMin = new Vector2(28, -120);
            header.offsetMax = new Vector2(-20, -16);
            var hl = UIFactory.AddHorizontalLayout(header.gameObject, 12f);
            hl.childForceExpandWidth = false;

            var titles = UIFactory.CreateRect("Titles", header);
            UIFactory.AddVerticalLayout(titles.gameObject, 2f).childAlignment = TextAnchor.MiddleLeft;
            UIFactory.SetLayout(titles, flexibleWidth: 1f);
            _title = UIFactory.CreateText("Title", titles, "", UITheme.FontTitle, UITheme.TextPrimary, TextAnchor.MiddleLeft, FontStyle.Bold);
            _subtitle = UIFactory.CreateText("Subtitle", titles, "", UITheme.FontSmall, UITheme.TextSecondary);

            var close = UIFactory.CreateButton("Close", header, "X", UITheme.ButtonSecondary, () => _selection.Select(-1));
            UIFactory.SetLayout(close.Background, preferredWidth: 84f, flexibleWidth: 0f);

            _content = UIFactory.CreateScrollList("Body", panel.transform, out _scroll);
            var body = (RectTransform)_scroll.transform;
            body.anchorMin = Vector2.zero;
            body.anchorMax = Vector2.one;
            body.offsetMin = new Vector2(28, 24);
            body.offsetMax = new Vector2(-28, -136);

            _selection.SelectionChanged += _ => { _mode = Mode.Details; _dirty = true; _resetScroll = true; };
            session.Events.Subscribe<LotOwnershipChanged>(_ => _dirty = true);
            session.Events.Subscribe<BuildingPlaced>(_ => _dirty = true);
            session.Events.Subscribe<BuildingRemoved>(_ => _dirty = true);
            session.Events.Subscribe<BuildingStateChanged>(_ => _dirty = true);
            session.Events.Subscribe<CashChanged>(e => { if (e.CompanyId == session.Player.Id) _dirty = true; });
            session.Events.Subscribe<LotDevelopmentChanged>(e => { if (e.LotId == _selection.SelectedLotId) _dirty = true; });
            session.Events.Subscribe<DayStarted>(_ => _dirty = true); // preços mudam na virada do dia

            _root.SetActive(false);
        }

        public void CloseOrBack()
        {
            if (_mode == Mode.BuildMenu) { _mode = Mode.Details; _dirty = true; _resetScroll = true; }
            else _selection.Select(-1);
        }

        public void Update()
        {
            var lot = _session.City.GetLot(_selection.SelectedLotId);
            if (lot == null)
            {
                if (_root.activeSelf) _root.SetActive(false);
                return;
            }
            if (!_root.activeSelf) { _root.SetActive(true); _dirty = true; }

            if (_dirty)
            {
                _dirty = false;
                float scrollPos = _scroll.verticalNormalizedPosition;
                Rebuild(lot);
                Canvas.ForceUpdateCanvases();
                _scroll.verticalNormalizedPosition = _resetScroll ? 1f : scrollPos;
                _resetScroll = false;
            }
            UpdateProgress(lot);
        }

        // ------------------------------------------------------------------ Construção do conteúdo

        private void Rebuild(Lot lot)
        {
            UIFactory.ClearChildren(_content);
            _progressFill = null;
            _progressLabel = null;

            var building = _session.GetBuildingOnLot(lot);
            int me = _session.Player.Id;

            _title.text = building != null ? building.Definition.DisplayName
                : lot.IsAmbient ? UIStrings.AmbientName(lot.Ambient)
                : "Terreno #" + lot.Id;
            _subtitle.text = "Zona " + UIStrings.DistrictName(lot.District) + "  ·  Terreno #" + lot.Id;

            if (_mode == Mode.BuildMenu && lot.OwnerId == me && !lot.HasBuilding)
            {
                BuildMenu(lot);
                return;
            }
            _mode = Mode.Details;

            var market = _session.LandMarket;
            float cs = _db.cellSize;
            Info("Área", (lot.Rect.Width * cs).ToString("0") + " × " + (lot.Rect.Height * cs).ToString("0") + " m  (" + (lot.Rect.Area * cs * cs).ToString("0") + " m²)");
            if (lot.District != District.Park)
            {
                Info("Valor de mercado", UIStrings.FormatMoney(market.MarketValue(lot)));
                if (lot.NeighborhoodBonus > 0.0005)
                    Info("Valorização do bairro", "+" + (lot.NeighborhoodBonus * 100).ToString("0.0") + "%  (vizinhança ocupada e praças próximas)");
            }
            Info("Proprietário", OwnerName(lot));

            if (lot.OwnerId == me)
            {
                Info("Imposto predial", UIStrings.FormatMoney(market.DailyPropertyTax(lot)) + " / dia");
                if (building != null) BuildingSection(building);
                else OwnedEmptyActions(lot);
            }
            else if (lot.IsForSale)
            {
                Info("Custo total", UIStrings.FormatMoney(market.PurchaseCost(lot)) + "  (inclui " + UIStrings.FormatMoney(market.TransferTax(lot)) + " de imposto)");
                Note("Terreno à venda pela prefeitura. Após a compra você poderá construir um estabelecimento.");
                var check = _session.CanBuyLot(me, lot.Id);
                ActionButton("Comprar terreno — " + UIStrings.FormatMoneyShort(market.PurchaseCost(lot)), UITheme.ButtonSuccess, check, () =>
                {
                    var r = _session.BuyLot(me, lot.Id);
                    Report(r, "Terreno #" + lot.Id + " comprado!");
                });
            }
            else if (lot.District == District.Park)
            {
                Note("Área pública da prefeitura. Praças valorizam a vizinhança e não podem ser compradas.");
            }
            else if (lot.IsUnderDevelopment)
            {
                Info("Obra particular", UIStrings.AmbientName(lot.Ambient) + " — conclui em " + UIStrings.Hours(lot.DevelopmentHoursLeft));
                Note("A cidade cresce sozinha: moradores e empresas locais ocupam terrenos vagos, valorizando o bairro.");
            }
            else if (lot.IsAmbient)
            {
                Note("Imóvel ocupado por moradores ou empresas locais. Não está à venda no momento.");
            }
        }

        private void BuildingSection(BuildingInstance b)
        {
            int me = _session.Player.Id;
            var def = b.Definition;
            Separator();
            Info("Categoria", UIStrings.CategoryName(def.Category));
            Info("Nível", b.Level + " / " + def.MaxLevel);
            Info("Situação", UIStrings.StateName(b.State));

            if (b.IsBusy)
            {
                ProgressBar();
                UpdateProgress(_session.City.GetLot(b.LotId));
                Info("Manutenção", b.State == BuildingState.UnderConstruction ? "começa após a obra"
                    : UIStrings.FormatMoney(def.MaintenanceAtLevel(b.Level)) + " / dia");
            }
            else
            {
                Info("Manutenção", UIStrings.FormatMoney(def.MaintenanceAtLevel(b.Level)) + " / dia");
            }
            Info("Investido", UIStrings.FormatMoney(b.TotalInvested));
            Note("A produção e as vendas deste estabelecimento serão ativadas na Fase 3 (Economia e Produção).");

            if (b.Level < def.MaxLevel)
            {
                var up = _session.CanUpgrade(me, b.Id);
                var cost = def.UpgradeCost(b.Level);
                string label = "Melhorar p/ nível " + (b.Level + 1) + " — " + UIStrings.FormatMoneyShort(cost);
                ActionButton(label, UITheme.ButtonPrimary, up, () =>
                {
                    var r = _session.Upgrade(me, b.Id);
                    Report(r, "Melhoria iniciada: " + def.DisplayName + " (nível " + (b.Level + 1) + ")");
                });
                if (up.Success || up.Error == CommandError.InsufficientFunds)
                    Note("Duração: " + UIStrings.Hours(def.UpgradeHours(b.Level)) + "  ·  Manutenção no nível " + (b.Level + 1) + ": " +
                         UIStrings.FormatMoney(def.MaintenanceAtLevel(b.Level + 1)) + "/dia");
            }

            var demolish = _session.CanDemolish(me, b.Id);
            ActionButton("Demolir (+" + UIStrings.FormatMoneyShort(demolish.Amount) + ")", UITheme.ButtonDanger, demolish, () =>
            {
                _dialog.Show("Demolir " + def.DisplayName + "?",
                    "Você receberá apenas " + UIStrings.FormatMoney(demolish.Amount) + " (25% do investido). Esta ação não pode ser desfeita.",
                    "Demolir", UITheme.ButtonDanger, () =>
                    {
                        var r = _session.Demolish(me, b.Id);
                        Report(r, def.DisplayName + " demolido.");
                    });
            });
        }

        private void OwnedEmptyActions(Lot lot)
        {
            int me = _session.Player.Id;
            Note("Terreno vazio da sua empresa. Escolha um estabelecimento para construir.");
            var build = UIFactory.CreateButton("Build", _content, "Construir estabelecimento", UITheme.ButtonPrimary, () =>
            {
                _mode = Mode.BuildMenu;
                _dirty = true;
                _resetScroll = true;
            });
            build.SetInteractable(true);

            var sell = _session.CanSellLot(me, lot.Id);
            ActionButton("Vender terreno (+" + UIStrings.FormatMoneyShort(sell.Amount) + ")", UITheme.ButtonSecondary, sell, () =>
            {
                _dialog.Show("Vender terreno #" + lot.Id + "?",
                    "A prefeitura pagará " + UIStrings.FormatMoney(sell.Amount) + " (80% do valor de mercado).",
                    "Vender", UITheme.ButtonDanger, () =>
                    {
                        var r = _session.SellLot(me, lot.Id);
                        Report(r, "Terreno #" + lot.Id + " vendido.");
                    });
            });
        }

        private void BuildMenu(Lot lot)
        {
            int me = _session.Player.Id;
            var back = UIFactory.CreateButton("Back", _content, "< Voltar", UITheme.ButtonSecondary, () =>
            {
                _mode = Mode.Details;
                _dirty = true;
                _resetScroll = true;
            });
            UIFactory.SetLayout(back.Background, preferredHeight: 70f);

            foreach (var def in _session.Catalog.All)
            {
                var check = _session.CanConstruct(me, lot.Id, def.Id);
                // Edifícios que nunca caberiam neste terreno ficam no fim da lista, ainda visíveis com o motivo.
                var card = UIFactory.CreatePanel("Card_" + def.Id, _content, UITheme.CardBackground);
                UIFactory.AddVerticalLayout(card.gameObject, 8f, new RectOffset(22, 22, 18, 18));

                var asset = _db.FindAsset(def.Id);
                UIFactory.CreateText("Name", card.transform, def.DisplayName + "  " + UIFactory.Colorize(UIStrings.CategoryName(def.Category), UITheme.TextSecondary),
                    UITheme.FontTitle - 4, UITheme.TextPrimary, TextAnchor.MiddleLeft, FontStyle.Bold);
                if (asset != null)
                {
                    var stripe = UIFactory.CreatePanel("Color", card.transform, asset.accentColor);
                    UIFactory.SetLayout(stripe, preferredHeight: 6f);
                    stripe.transform.SetSiblingIndex(0);
                }
                if (!string.IsNullOrEmpty(def.Description))
                    UIFactory.CreateText("Desc", card.transform, def.Description, UITheme.FontSmall, UITheme.TextSecondary);
                UIFactory.CreateText("Stats", card.transform,
                    "Custo: " + UIStrings.FormatMoney(def.ConstructionCost) +
                    "\nObra: " + UIStrings.Hours(def.ConstructionHours) + "  ·  Manutenção: " + UIStrings.FormatMoneyShort(def.DailyMaintenance) + "/dia" +
                    "\nZonas: " + UIStrings.AllowedDistricts(def.AllowedDistricts) + "  ·  Níveis: " + def.MaxLevel,
                    UITheme.FontSmall, UITheme.TextPrimary);

                var btn = UIFactory.CreateButton("Construct", card.transform,
                    check.Success ? "Construir — " + UIStrings.FormatMoneyShort(def.ConstructionCost) : UIStrings.ErrorText(check.Error),
                    UITheme.ButtonSuccess, () =>
                    {
                        var r = _session.Construct(me, lot.Id, def.Id);
                        if (r.Success) _mode = Mode.Details;
                        Report(r, "Obra iniciada: " + def.DisplayName + " (" + UIStrings.Hours(def.ConstructionHours) + ")");
                    });
                btn.SetInteractable(check.Success);
                if (!check.Success) card.transform.SetAsLastSibling();
            }
        }

        // ------------------------------------------------------------------ Elementos

        private void Info(string label, string value)
        {
            var row = UIFactory.CreateText("Info_" + label, _content,
                UIFactory.Colorize(label, UITheme.TextSecondary) + "\n" + value, UITheme.FontBody, UITheme.TextPrimary);
            UIFactory.SetLayout(row, minHeight: 72f);
        }

        private void Note(string text)
        {
            var t = UIFactory.CreateText("Note", _content, text, UITheme.FontSmall, UITheme.TextWarning);
            t.fontStyle = FontStyle.Italic;
        }

        private void Separator()
        {
            var sep = UIFactory.CreatePanel("Separator", _content, new Color(1, 1, 1, 0.08f), rounded: false);
            UIFactory.SetLayout(sep, preferredHeight: 2f);
        }

        private void ActionButton(string label, Color color, CommandResult check, Action onClick)
        {
            string text = check.Success || check.Error == CommandError.None ? label : label + "\n" + UIFactory.Colorize(UIStrings.ErrorText(check.Error), UITheme.TextWarning);
            var btn = UIFactory.CreateButton("Action", _content, text, color, () => onClick());
            btn.SetInteractable(check.Success);
            if (!check.Success) UIFactory.SetLayout(btn.Background, preferredHeight: UITheme.ButtonHeight + 30f);
        }

        private void ProgressBar()
        {
            var bg = UIFactory.CreatePanel("Progress", _content, UITheme.CardBackground);
            UIFactory.SetLayout(bg, preferredHeight: 44f);
            var fill = UIFactory.CreatePanel("Fill", bg.transform, UITheme.ButtonActive);
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = new Vector2(0f, 1f);
            fill.rectTransform.offsetMin = Vector2.zero;
            fill.rectTransform.offsetMax = Vector2.zero;
            _progressFill = fill;
            _progressLabel = UIFactory.CreateText("Label", bg.transform, "", UITheme.FontSmall, UITheme.TextPrimary, TextAnchor.MiddleCenter, FontStyle.Bold);
            UIFactory.Stretch(_progressLabel.rectTransform);
        }

        private void UpdateProgress(Lot lot)
        {
            if (_progressFill == null || lot == null) return;
            var b = _session.GetBuildingOnLot(lot);
            if (b == null || !b.IsBusy) return;
            float p = b.WorkProgress01;
            _progressFill.rectTransform.anchorMax = new Vector2(Mathf.Clamp01(p), 1f);
            _progressLabel.text = Mathf.FloorToInt(p * 100f) + "%  ·  faltam " + UIStrings.Hours(b.RemainingHours);
        }

        private string OwnerName(Lot lot)
        {
            if (lot.OwnerId == Lot.NoOwner)
                return lot.IsAmbient ? "Particular" : lot.District == District.Park ? "Prefeitura" : "Prefeitura (à venda)";
            var c = _session.GetCompany(lot.OwnerId);
            if (c == null) return "Desconhecido";
            return c.IsPlayer ? UIFactory.Colorize(c.Name + " (você)", UITheme.TextPositive) : c.Name;
        }

        private void Report(CommandResult r, string successMessage)
        {
            if (r.Success) _toasts.Show(successMessage, ToastKind.Success);
            else _toasts.Show(UIStrings.ErrorText(r.Error), ToastKind.Error);
            _dirty = true;
        }
    }
}
