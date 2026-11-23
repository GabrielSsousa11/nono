using System;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>Diálogo modal de confirmação para ações destrutivas ou caras.</summary>
    public sealed class ConfirmDialog
    {
        private readonly GameObject _root;
        private readonly Text _title;
        private readonly Text _message;
        private readonly UIFactory.ButtonHandle _confirm;
        private Action _onConfirm;

        public bool IsOpen => _root.activeSelf;

        public ConfirmDialog(Transform canvas)
        {
            var overlay = UIFactory.CreatePanel("ConfirmDialog", canvas, UITheme.Overlay, rounded: false);
            UIFactory.Stretch(overlay.rectTransform);
            overlay.raycastTarget = true;
            _root = overlay.gameObject;

            var box = UIFactory.CreatePanel("Box", overlay.transform, UITheme.PanelBackgroundLight);
            box.rectTransform.anchorMin = box.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            box.rectTransform.sizeDelta = new Vector2(760f, 0f);
            UIFactory.AddVerticalLayout(box.gameObject, 18f, new RectOffset(36, 36, 32, 32));
            var fitter = box.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            _title = UIFactory.CreateText("Title", box.transform, "", UITheme.FontTitle, UITheme.TextPrimary, TextAnchor.MiddleLeft, FontStyle.Bold);
            _message = UIFactory.CreateText("Message", box.transform, "", UITheme.FontBody, UITheme.TextSecondary, TextAnchor.UpperLeft);

            var row = UIFactory.CreateRect("Buttons", box.transform);
            UIFactory.AddHorizontalLayout(row.gameObject, 18f);
            UIFactory.SetLayout(row, preferredHeight: UITheme.ButtonHeight);
            UIFactory.CreateButton("Cancel", row, "Cancelar", UITheme.ButtonSecondary, Close);
            _confirm = UIFactory.CreateButton("Confirm", row, "Confirmar", UITheme.ButtonDanger, Confirm);

            _root.SetActive(false);
        }

        public void Show(string title, string message, string confirmLabel, Color confirmColor, Action onConfirm)
        {
            _title.text = title;
            _message.text = message;
            _confirm.Label.text = confirmLabel;
            _confirm.SetColor(confirmColor);
            _onConfirm = onConfirm;
            _root.transform.SetAsLastSibling();
            _root.SetActive(true);
        }

        public void Close()
        {
            _onConfirm = null;
            _root.SetActive(false);
        }

        private void Confirm()
        {
            var action = _onConfirm;
            Close();
            action?.Invoke();
        }
    }
}
