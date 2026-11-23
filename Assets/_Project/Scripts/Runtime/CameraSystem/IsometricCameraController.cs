using EmpireTycoon.Runtime.InputHandling;
using UnityEngine;

namespace EmpireTycoon.Runtime.CameraSystem
{
    /// <summary>
    /// Câmera isométrica (perspectiva com FOV baixo) com pan "agarrando o chão", zoom por pinça/roda,
    /// rotação livre e limites da cidade. Movimentos são suavizados para uma sensação polida.
    /// Hierarquia: Rig (posição/rotação Y) → Camera (inclinação + distância).
    /// </summary>
    public sealed class IsometricCameraController : MonoBehaviour
    {
        [SerializeField] private float pitch = 52f;
        [SerializeField] private float minDistance = 35f;
        [SerializeField] private float maxDistance = 260f;
        [SerializeField] private float fieldOfView = 30f;
        [SerializeField] private float smoothTime = 0.08f;
        [SerializeField] private float keyboardPanSpeed = 0.9f;

        private Camera _camera;
        private Bounds _limits;
        private Vector3 _targetPosition;
        private float _targetYaw = 45f;
        private float _targetDistance = 140f;
        private float _yaw;
        private float _distance;
        private Vector3 _velocity;

        public Camera Camera => _camera;

        public void Initialize(Camera cam, Bounds cityBounds, Vector3 focus)
        {
            _camera = cam;
            _camera.fieldOfView = fieldOfView;
            _camera.nearClipPlane = 1f;
            _camera.farClipPlane = 1200f;
            _limits = cityBounds;
            _limits.Expand(new Vector3(20f, 0f, 20f));
            _targetPosition = ClampToLimits(focus);
            transform.position = _targetPosition;
            _yaw = _targetYaw;
            _distance = _targetDistance;
            ApplyTransform();
        }

        /// <summary>Centraliza suavemente em um ponto do mundo.</summary>
        public void FocusOn(Vector3 worldPoint)
        {
            _targetPosition = ClampToLimits(new Vector3(worldPoint.x, 0f, worldPoint.z));
        }

        public void HandleInput(in GestureFrame input)
        {
            if (_camera == null) return;

            if (input.HasPan)
            {
                // Pan exato: o ponto do chão sob o dedo acompanha o dedo.
                if (GroundPoint(input.PanFrom, out var from) && GroundPoint(input.PanTo, out var to))
                    _targetPosition = ClampToLimits(_targetPosition + (from - to));
            }

            if (input.KeyboardPan != Vector2.zero)
            {
                var fwd = Quaternion.Euler(0, _yaw, 0) * Vector3.forward;
                var right = Quaternion.Euler(0, _yaw, 0) * Vector3.right;
                var move = (right * input.KeyboardPan.x + fwd * input.KeyboardPan.y) * (_distance * keyboardPanSpeed * Time.unscaledDeltaTime);
                _targetPosition = ClampToLimits(_targetPosition + move);
            }

            if (!Mathf.Approximately(input.Zoom, 1f) && input.Zoom > 0f)
                _targetDistance = Mathf.Clamp(_targetDistance / input.Zoom, minDistance, maxDistance);

            if (Mathf.Abs(input.RotateDegrees) > 0.0001f)
                _targetYaw += input.RotateDegrees;
        }

        private void LateUpdate()
        {
            if (_camera == null) return;
            float dt = Time.unscaledDeltaTime;
            transform.position = Vector3.SmoothDamp(transform.position, _targetPosition, ref _velocity, smoothTime, Mathf.Infinity, dt);
            float k = 1f - Mathf.Exp(-dt / Mathf.Max(0.001f, smoothTime) * 1.5f);
            _yaw = Mathf.LerpAngle(_yaw, _targetYaw, k);
            _distance = Mathf.Lerp(_distance, _targetDistance, k);
            ApplyTransform();
        }

        private void ApplyTransform()
        {
            transform.rotation = Quaternion.Euler(0f, _yaw, 0f);
            var camTransform = _camera.transform;
            camTransform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
            camTransform.localPosition = camTransform.localRotation * new Vector3(0f, 0f, -_distance);
        }

        private bool GroundPoint(Vector2 screen, out Vector3 point)
        {
            // Usa a pose-alvo para evitar "escorregões" durante a suavização.
            var ray = _camera.ScreenPointToRay(screen);
            var plane = new Plane(Vector3.up, Vector3.zero);
            if (plane.Raycast(ray, out float d) && d < 5000f)
            {
                point = ray.GetPoint(d);
                return true;
            }
            point = default;
            return false;
        }

        private Vector3 ClampToLimits(Vector3 p)
        {
            return new Vector3(
                Mathf.Clamp(p.x, _limits.min.x, _limits.max.x),
                0f,
                Mathf.Clamp(p.z, _limits.min.z, _limits.max.z));
        }
    }
}
