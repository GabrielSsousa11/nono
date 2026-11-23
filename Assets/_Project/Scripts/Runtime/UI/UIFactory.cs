using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace EmpireTycoon.Runtime.UI
{
    /// <summary>
    /// Criação de elementos uGUI via código, com estilo consistente (cantos arredondados gerados
    /// em tempo de execução, sem depender de sprites externos). Ver Docs/ARCHITECTURE.md (UI).
    /// </summary>
    public static class UIFactory
    {
        private static Font _font;
        private static Sprite _rounded;

        public static Font Font
        {
            get
            {
                if (_font == null) _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                return _font;
            }
        }

        /// <summary>Sprite 9-slice com cantos arredondados (gerado uma vez).</summary>
        public static Sprite RoundedSprite
        {
            get
            {
                if (_rounded != null) return _rounded;
                const int size = 64;
                const int radius = 20;
                var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
                {
                    name = "UI_Rounded",
                    wrapMode = TextureWrapMode.Clamp,
                    filterMode = FilterMode.Bilinear,
                };
                var pixels = new Color32[size * size];
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, radius, size - radius);
                    float cy = Mathf.Clamp(y + 0.5f, radius, size - radius);
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
                    byte a = (byte)(Mathf.Clamp01(radius - d + 0.5f) * 255f);
                    pixels[y * size + x] = new Color32(255, 255, 255, a);
                }
                tex.SetPixels32(pixels);
                tex.Apply(false, true);
                _rounded = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0,
                    SpriteMeshType.FullRect, new Vector4(radius, radius, radius, radius));
                _rounded.name = "UI_Rounded";
                return _rounded;
            }
        }

        public static RectTransform CreateRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = 5; // UI
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        public static void Stretch(RectTransform rt, float left = 0, float right = 0, float top = 0, float bottom = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
        }

        public static Image CreatePanel(string name, Transform parent, Color color, bool rounded = true)
        {
            var rt = CreateRect(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            if (rounded)
            {
                img.sprite = RoundedSprite;
                img.type = Image.Type.Sliced;
                img.pixelsPerUnitMultiplier = 20f / UITheme.CornerRadius; // borda do sprite = 20 px
            }
            return img;
        }

        public static Text CreateText(string name, Transform parent, string text, int fontSize, Color color,
            TextAnchor alignment = TextAnchor.MiddleLeft, FontStyle style = FontStyle.Normal)
        {
            var rt = CreateRect(name, parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font;
            t.text = text;
            t.fontSize = fontSize;
            t.color = color;
            t.alignment = alignment;
            t.fontStyle = style;
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.supportRichText = true;
            return t;
        }

        public sealed class ButtonHandle
        {
            public Button Button;
            public Image Background;
            public Text Label;
            public Color BaseColor;

            public void SetInteractable(bool value)
            {
                Button.interactable = value;
                Background.color = value ? BaseColor : UITheme.ButtonDisabled;
                Label.color = value ? UITheme.TextPrimary : UITheme.TextSecondary;
            }

            public void SetColor(Color c)
            {
                BaseColor = c;
                if (Button.interactable) Background.color = c;
            }
        }

        public static ButtonHandle CreateButton(string name, Transform parent, string label, Color color, UnityAction onClick, int fontSize = UITheme.FontBody)
        {
            var bg = CreatePanel(name, parent, color);
            bg.raycastTarget = true;
            var button = bg.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.08f, 1.08f, 1.08f);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f);
            colors.disabledColor = Color.white;
            colors.fadeDuration = 0.06f;
            button.colors = colors;
            button.targetGraphic = bg;
            if (onClick != null) button.onClick.AddListener(onClick);

            var text = CreateText("Label", bg.transform, label, fontSize, UITheme.TextPrimary, TextAnchor.MiddleCenter, FontStyle.Bold);
            Stretch(text.rectTransform, 12, 12, 4, 4);
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.resizeTextForBestFit = true;
            text.resizeTextMinSize = 16;
            text.resizeTextMaxSize = fontSize;

            var le = bg.gameObject.AddComponent<LayoutElement>();
            le.minHeight = UITheme.ButtonHeight;
            le.preferredHeight = UITheme.ButtonHeight;

            return new ButtonHandle { Button = button, Background = bg, Label = text, BaseColor = color };
        }

        public static VerticalLayoutGroup AddVerticalLayout(GameObject go, float spacing, RectOffset padding = null, bool expandHeight = false)
        {
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.spacing = spacing;
            v.padding = padding ?? new RectOffset(0, 0, 0, 0);
            v.childAlignment = TextAnchor.UpperLeft;
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = expandHeight;
            return v;
        }

        public static HorizontalLayoutGroup AddHorizontalLayout(GameObject go, float spacing, RectOffset padding = null)
        {
            var h = go.AddComponent<HorizontalLayoutGroup>();
            h.spacing = spacing;
            h.padding = padding ?? new RectOffset(0, 0, 0, 0);
            h.childAlignment = TextAnchor.MiddleCenter;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = true;
            h.childForceExpandHeight = true;
            return h;
        }

        public static LayoutElement SetLayout(Component c, float preferredHeight = -1, float minHeight = -1, float flexibleWidth = -1, float preferredWidth = -1)
        {
            var le = c.GetComponent<LayoutElement>();
            if (le == null) le = c.gameObject.AddComponent<LayoutElement>();
            if (preferredHeight >= 0) le.preferredHeight = preferredHeight;
            if (minHeight >= 0) le.minHeight = minHeight;
            if (flexibleWidth >= 0) le.flexibleWidth = flexibleWidth;
            if (preferredWidth >= 0) le.preferredWidth = preferredWidth;
            return le;
        }

        /// <summary>Lista rolável vertical. Retorna o "content" onde os itens são adicionados.</summary>
        public static RectTransform CreateScrollList(string name, Transform parent, out ScrollRect scrollRect)
        {
            var root = CreateRect(name, parent);
            var bg = root.gameObject.AddComponent<Image>();
            bg.color = new Color(0, 0, 0, 0.001f); // necessário para receber arrasto
            scrollRect = root.gameObject.AddComponent<ScrollRect>();
            scrollRect.horizontal = false;
            scrollRect.vertical = true;
            scrollRect.movementType = ScrollRect.MovementType.Elastic;
            scrollRect.scrollSensitivity = 30f;

            var viewport = CreateRect("Viewport", root);
            Stretch(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            scrollRect.viewport = viewport;

            var content = CreateRect("Content", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = Vector2.zero;
            content.offsetMax = Vector2.zero;
            AddVerticalLayout(content.gameObject, 14f);
            var fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scrollRect.content = content;
            return content;
        }

        public static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
            {
                var child = t.GetChild(i).gameObject;
                child.SetActive(false);
                UnityEngine.Object.Destroy(child);
            }
        }

        public static string Colorize(string text, Color c) => "<color=#" + ColorUtility.ToHtmlStringRGB(c) + ">" + text + "</color>";
    }
}
