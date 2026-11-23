using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM && EMPIRE_INPUT_SYSTEM_PACKAGE
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using ETouch = UnityEngine.InputSystem.EnhancedTouch.Touch;
#endif

namespace EmpireTycoon.Runtime.InputHandling
{
    /// <summary>Resultado consolidado da entrada de um frame, independente do dispositivo.</summary>
    public struct GestureFrame
    {
        public bool HasPan;
        public Vector2 PanFrom;
        public Vector2 PanTo;
        /// <summary>Fator multiplicativo de zoom (&gt;1 aproxima).</summary>
        public float Zoom;
        /// <summary>Rotação em graus em torno do eixo vertical.</summary>
        public float RotateDegrees;
        /// <summary>Pan por teclado em unidades normalizadas (x = direita, y = frente).</summary>
        public Vector2 KeyboardPan;
        public bool Tap;
        public Vector2 TapPosition;
        /// <summary>Botão "voltar" do Android / tecla Esc.</summary>
        public bool Back;
    }

    /// <summary>
    /// Traduz toque (1 dedo: arrastar/tocar; 2 dedos: pinça, giro e arrasto), mouse e teclado
    /// em gestos de câmera e seleção. Suporta o Input System (recomendado) e o Input Manager legado.
    /// Toques iniciados sobre a interface não movem a câmera nem selecionam terrenos.
    /// </summary>
    public sealed class PointerGestureInput
    {
        private const float TapMaxDuration = 0.45f;
        private const int MousePointerId = -1;

        private struct PointerState
        {
            public Vector2 Start;
            public Vector2 Last;
            public float StartTime;
            public bool OverUI;
            public bool Moved;
        }

        private struct Sample
        {
            public int Id;
            public Vector2 Position;
        }

        private readonly Dictionary<int, PointerState> _active = new Dictionary<int, PointerState>();
        private readonly List<Sample> _samples = new List<Sample>(4);
        private readonly List<int> _released = new List<int>(4);
        private readonly List<RaycastResult> _uiHits = new List<RaycastResult>();
        private readonly float _tapSlop;
        private bool _gestureWasMulti;
        private float _prevPinchDistance;
        private float _prevPinchAngle;
        private Vector2 _prevPinchMid;
        private Vector2 _prevRightMouse;
        private bool _rightDragging;

        public PointerGestureInput()
        {
            float dpi = Screen.dpi > 0 ? Screen.dpi : 160f;
            _tapSlop = Mathf.Max(10f, dpi * 0.07f);
#if ENABLE_INPUT_SYSTEM && EMPIRE_INPUT_SYSTEM_PACKAGE
            if (!EnhancedTouchSupport.enabled) EnhancedTouchSupport.Enable();
#endif
        }

        public GestureFrame Poll()
        {
            var frame = new GestureFrame { Zoom = 1f };
            _samples.Clear();
            bool usingTouch = CollectTouches(_samples);
            if (!usingTouch) CollectMouse(_samples, ref frame);
            ProcessPointers(ref frame);
            ReadKeyboard(ref frame);
            return frame;
        }

        // ------------------------------------------------------------------ Lógica de gestos

        private void ProcessPointers(ref GestureFrame frame)
        {
            // Liberações → possível toque simples (tap).
            _released.Clear();
            foreach (var id in _active.Keys)
            {
                bool still = false;
                for (int i = 0; i < _samples.Count; i++) if (_samples[i].Id == id) { still = true; break; }
                if (!still) _released.Add(id);
            }
            foreach (var id in _released)
            {
                var st = _active[id];
                _active.Remove(id);
                if (_active.Count == 0 && _samples.Count == 0 && !_gestureWasMulti && !st.Moved && !st.OverUI &&
                    Time.unscaledTime - st.StartTime <= TapMaxDuration)
                {
                    frame.Tap = true;
                    frame.TapPosition = st.Last;
                }
            }
            if (_samples.Count == 0) _gestureWasMulti = false;

            // Novos ponteiros.
            foreach (var s in _samples)
            {
                if (_active.ContainsKey(s.Id)) continue;
                _active[s.Id] = new PointerState
                {
                    Start = s.Position,
                    Last = s.Position,
                    StartTime = Time.unscaledTime,
                    OverUI = IsOverUI(s.Position),
                };
                if (_samples.Count >= 2) ResetPinch();
            }

            if (_samples.Count == 1)
            {
                var s = _samples[0];
                var st = _active[s.Id];
                if (!st.Moved && (s.Position - st.Start).magnitude > _tapSlop) st.Moved = true;
                if (st.Moved && !st.OverUI && !_gestureWasMulti && s.Position != st.Last)
                {
                    frame.HasPan = true;
                    frame.PanFrom = st.Last;
                    frame.PanTo = s.Position;
                }
                st.Last = s.Position;
                _active[s.Id] = st;
            }
            else if (_samples.Count >= 2)
            {
                bool anyOverUI = false;
                foreach (var s in _samples) anyOverUI |= _active[s.Id].OverUI;
                if (!_gestureWasMulti) { _gestureWasMulti = true; ResetPinch(); }
                Vector2 a = _samples[0].Position, b = _samples[1].Position;
                float dist = Vector2.Distance(a, b);
                float angle = Mathf.Atan2(b.y - a.y, b.x - a.x) * Mathf.Rad2Deg;
                Vector2 mid = (a + b) * 0.5f;
                if (!anyOverUI && _prevPinchDistance > 1f)
                {
                    frame.Zoom = dist / _prevPinchDistance;
                    frame.RotateDegrees = Mathf.DeltaAngle(_prevPinchAngle, angle);
                    frame.HasPan = true;
                    frame.PanFrom = _prevPinchMid;
                    frame.PanTo = mid;
                }
                _prevPinchDistance = dist;
                _prevPinchAngle = angle;
                _prevPinchMid = mid;
                for (int i = 0; i < _samples.Count; i++)
                {
                    var st = _active[_samples[i].Id];
                    st.Last = _samples[i].Position;
                    st.Moved = true;
                    _active[_samples[i].Id] = st;
                }
            }
        }

        private void ResetPinch()
        {
            _prevPinchDistance = 0f;
        }

        private bool IsOverUI(Vector2 screenPos)
        {
            var es = EventSystem.current;
            if (es == null) return false;
            var data = new PointerEventData(es) { position = screenPos };
            _uiHits.Clear();
            es.RaycastAll(data, _uiHits);
            return _uiHits.Count > 0;
        }

        // ------------------------------------------------------------------ Leitura de dispositivos

#if ENABLE_INPUT_SYSTEM && EMPIRE_INPUT_SYSTEM_PACKAGE
        private bool CollectTouches(List<Sample> samples)
        {
            var touches = ETouch.activeTouches;
            for (int i = 0; i < touches.Count; i++)
            {
                var t = touches[i];
                var phase = t.phase;
                if (phase == UnityEngine.InputSystem.TouchPhase.Ended || phase == UnityEngine.InputSystem.TouchPhase.Canceled) continue;
                samples.Add(new Sample { Id = t.touchId, Position = t.screenPosition });
            }
            return samples.Count > 0;
        }

        private void CollectMouse(List<Sample> samples, ref GestureFrame frame)
        {
            var mouse = Mouse.current;
            if (mouse == null) return;
            Vector2 pos = mouse.position.ReadValue();
            if (mouse.leftButton.isPressed || mouse.middleButton.isPressed) samples.Add(new Sample { Id = MousePointerId, Position = pos });

            float scroll = mouse.scroll.ReadValue().y;
            if (Mathf.Abs(scroll) > 0.01f && !IsOverUI(pos)) frame.Zoom *= Mathf.Pow(1.12f, Mathf.Sign(scroll) * Mathf.Min(3f, Mathf.Abs(scroll) / 120f + 0.5f));

            if (mouse.rightButton.wasPressedThisFrame) { _rightDragging = !IsOverUI(pos); _prevRightMouse = pos; }
            if (mouse.rightButton.isPressed && _rightDragging)
            {
                frame.RotateDegrees += (pos.x - _prevRightMouse.x) * 0.3f;
                _prevRightMouse = pos;
            }
            if (!mouse.rightButton.isPressed) _rightDragging = false;
        }

        private static void ReadKeyboard(ref GestureFrame frame)
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            Vector2 pan = Vector2.zero;
            if (kb.wKey.isPressed || kb.upArrowKey.isPressed) pan.y += 1;
            if (kb.sKey.isPressed || kb.downArrowKey.isPressed) pan.y -= 1;
            if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) pan.x += 1;
            if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) pan.x -= 1;
            frame.KeyboardPan = pan;
            frame.Back = kb.escapeKey.wasPressedThisFrame;
            if (kb.qKey.isPressed) frame.RotateDegrees += 90f * Time.unscaledDeltaTime;
            if (kb.eKey.isPressed) frame.RotateDegrees -= 90f * Time.unscaledDeltaTime;
            if (kb.equalsKey.isPressed || kb.numpadPlusKey.isPressed) frame.Zoom *= 1f + 1.5f * Time.unscaledDeltaTime;
            if (kb.minusKey.isPressed || kb.numpadMinusKey.isPressed) frame.Zoom /= 1f + 1.5f * Time.unscaledDeltaTime;
        }
#else
        private bool CollectTouches(List<Sample> samples)
        {
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled) continue;
                samples.Add(new Sample { Id = t.fingerId, Position = t.position });
            }
            return samples.Count > 0;
        }

        private void CollectMouse(List<Sample> samples, ref GestureFrame frame)
        {
            if (!Input.mousePresent) return;
            Vector2 pos = Input.mousePosition;
            if (Input.GetMouseButton(0) || Input.GetMouseButton(2)) samples.Add(new Sample { Id = MousePointerId, Position = pos });

            float scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > 0.01f && !IsOverUI(pos)) frame.Zoom *= Mathf.Pow(1.12f, Mathf.Clamp(scroll, -3f, 3f));

            if (Input.GetMouseButtonDown(1)) { _rightDragging = !IsOverUI(pos); _prevRightMouse = pos; }
            if (Input.GetMouseButton(1) && _rightDragging)
            {
                frame.RotateDegrees += (pos.x - _prevRightMouse.x) * 0.3f;
                _prevRightMouse = pos;
            }
            if (!Input.GetMouseButton(1)) _rightDragging = false;
        }

        private static void ReadKeyboard(ref GestureFrame frame)
        {
            Vector2 pan = Vector2.zero;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) pan.y += 1;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) pan.y -= 1;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) pan.x += 1;
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) pan.x -= 1;
            frame.KeyboardPan = pan;
            frame.Back = Input.GetKeyDown(KeyCode.Escape);
            if (Input.GetKey(KeyCode.Q)) frame.RotateDegrees += 90f * Time.unscaledDeltaTime;
            if (Input.GetKey(KeyCode.E)) frame.RotateDegrees -= 90f * Time.unscaledDeltaTime;
            if (Input.GetKey(KeyCode.Equals) || Input.GetKey(KeyCode.KeypadPlus)) frame.Zoom *= 1f + 1.5f * Time.unscaledDeltaTime;
            if (Input.GetKey(KeyCode.Minus) || Input.GetKey(KeyCode.KeypadMinus)) frame.Zoom /= 1f + 1.5f * Time.unscaledDeltaTime;
        }
#endif
    }
}
