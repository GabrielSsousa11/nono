using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    public enum ToastKind { Info, Success, Error }

    /// <summary>Notificações curtas empilhadas no topo da tela, que somem sozinhas.</summary>
    public sealed class ToastView : MonoBehaviour
    {
        private const int MaxVisible = 3;
        private const float Duration = 3.2f;
        private const float Fade = 0.35f;

        private sealed class Entry
        {
            public CanvasGroup Group;
            public float Age;
        }

        private readonly List<Entry> _entries = new List<Entry>();
        private RectTransform _container;

        public void Initialize(RectTransform parent)
        {
            _container = UIFactory.CreateRect("Toasts", parent);
            _container.anchorMin = new Vector2(0.5f, 1f);
            _container.anchorMax = new Vector2(0.5f, 1f);
            _container.pivot = new Vector2(0.5f, 1f);
            _container.anchoredPosition = new Vector2(0, -150f);
            _container.sizeDelta = new Vector2(820f, 400f);
            UIFactory.AddVerticalLayout(_container.gameObject, 10f).childAlignment = TextAnchor.UpperCenter;
        }

        public void Show(string message, ToastKind kind = ToastKind.Info)
        {
            if (_container == null) return;
            while (_entries.Count >= MaxVisible) Remove(_entries[0]);

            Color accent = kind == ToastKind.Success ? UITheme.ButtonSuccess : kind == ToastKind.Error ? UITheme.ButtonDanger : UITheme.ButtonPrimary;
            var panel = UIFactory.CreatePanel("Toast", _container, UITheme.PanelBackground);
            panel.raycastTarget = false;
            UIFactory.AddHorizontalLayout(panel.gameObject, 14f, new RectOffset(18, 24, 14, 14)).childForceExpandWidth = false;
            UIFactory.SetLayout(panel, preferredHeight: 76f);

            var stripe = UIFactory.CreatePanel("Accent", panel.transform, accent);
            stripe.raycastTarget = false;
            UIFactory.SetLayout(stripe, preferredWidth: 10f, flexibleWidth: 0f);

            var text = UIFactory.CreateText("Text", panel.transform, message, UITheme.FontBody, UITheme.TextPrimary, TextAnchor.MiddleLeft);
            UIFactory.SetLayout(text, flexibleWidth: 1f);

            var group = panel.gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.interactable = false;
            _entries.Add(new Entry { Group = group, Age = 0f });
        }

        private void Update()
        {
            for (int i = _entries.Count - 1; i >= 0; i--)
            {
                var e = _entries[i];
                e.Age += Time.unscaledDeltaTime;
                float alpha = e.Age < Fade ? e.Age / Fade : e.Age > Duration - Fade ? (Duration - e.Age) / Fade : 1f;
                e.Group.alpha = Mathf.Clamp01(alpha);
                if (e.Age >= Duration) Remove(e);
            }
        }

        private void Remove(Entry e)
        {
            _entries.Remove(e);
            if (e.Group != null) Destroy(e.Group.gameObject);
        }
    }
}
