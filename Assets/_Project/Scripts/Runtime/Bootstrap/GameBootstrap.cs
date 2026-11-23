using System;
using EmpireTycoon.Runtime.CameraSystem;
using EmpireTycoon.Runtime.Data;
using EmpireTycoon.Runtime.InputHandling;
using EmpireTycoon.Runtime.Interaction;
using EmpireTycoon.Runtime.Quality;
using EmpireTycoon.Runtime.Rendering;
using EmpireTycoon.Runtime.UI;
using EmpireTycoon.Simulation.Session;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;

namespace EmpireTycoon.Runtime.Bootstrap
{
    /// <summary>
    /// Ponto de entrada da cena principal (composition root). Cria a simulação a partir do
    /// <see cref="GameDatabase"/> e monta as camadas de apresentação: luz, câmera, cidade 3D,
    /// entrada e interface. Nenhum outro script cria sistemas globais.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class GameBootstrap : MonoBehaviour
    {
        [SerializeField] private GameDatabase database;

        private GameSession _session;
        private MaterialLibrary _materials;
        private BuildingModelFactory _models;
        private CityView _cityView;
        private IsometricCameraController _camera;
        private SelectionController _selection;
        private PointerGestureInput _input;
        private GameUI _ui;
        private QualityPresetManager _quality;
        private string _fatalError;

        public GameSession Session => _session;

        private void Awake()
        {
            if (database == null) database = Resources.Load<GameDatabase>(GameDatabase.ResourcePath);
            if (database == null)
            {
                Fail("GameDatabase não encontrado em Resources/" + GameDatabase.ResourcePath + ".");
                return;
            }

            try
            {
                _session = new GameSession(database.newGameConfig, database.CreateDefinitions());
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                Fail("Configuração do jogo inválida: " + e.Message);
                return;
            }

            _quality = new QualityPresetManager();
            _quality.Initialize();
            Screen.sleepTimeout = SleepTimeout.SystemSetting;

            SetupLighting();
            var cam = SetupCamera();
            EnsureEventSystem();

            _materials = new MaterialLibrary(database.litMaterialTemplate);
            _models = new BuildingModelFactory();

            _cityView = new GameObject("City").AddComponent<CityView>();
            _cityView.Initialize(_session, database, _materials, _models);

            var starter = FindPlayerLot();
            var focus = starter != null ? _cityView.Mapping.RectCenter(starter.Rect) : Vector3.zero;
            _camera.Initialize(cam, _cityView.Mapping.WorldBounds, focus);

            _selection = new SelectionController(_cityView, cam);
            _input = new PointerGestureInput();

            _ui = new GameObject("UI").AddComponent<GameUI>();
            _ui.Initialize(_session, _selection, database, _quality);

            if (starter != null)
            {
                _selection.Select(starter.Id);
                _ui.Toasts.Show("Bem-vindo a " + _session.City.Name + "! Este é o seu primeiro terreno: construa seu negócio.", ToastKind.Info);
            }
        }

        private void Update()
        {
            if (_session == null) return;

            var frame = _input.Poll();
            if (frame.Back && !_ui.HandleBack()) _selection.Select(-1);
            _camera.HandleInput(frame);
            if (frame.Tap) _selection.HandleTap(frame.TapPosition);

            // Atualizações econômicas em ticks discretos (ver SimulationClock), independentes do FPS.
            _session.Advance(Mathf.Min(Time.unscaledDeltaTime, 0.25f));
        }

        private void OnDestroy()
        {
            _materials?.DestroyAll();
            _models?.DestroyAll();
        }

        private Simulation.WorldMap.Lot FindPlayerLot()
        {
            foreach (var lot in _session.City.Lots)
                if (lot.OwnerId == _session.Player.Id) return lot;
            return null;
        }

        // ------------------------------------------------------------------ Montagem da cena

        private static void SetupLighting()
        {
            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.95f, 0.86f);
            sun.intensity = 1.25f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.7f;
            sunGo.transform.rotation = Quaternion.Euler(50f, -38f, 0f);
            RenderSettings.sun = sun;

            var sky = new Color(0.66f, 0.74f, 0.86f);
            var equator = new Color(0.58f, 0.6f, 0.62f);
            var ground = new Color(0.36f, 0.34f, 0.3f);
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = sky;
            RenderSettings.ambientEquatorColor = equator;
            RenderSettings.ambientGroundColor = ground;

            // O probe ambiente precisa ser definido explicitamente em tempo de execução (cena gerada por código).
            var sh = new SphericalHarmonicsL2();
            sh.AddAmbientLight(equator * 0.85f);
            sh.AddDirectionalLight(Vector3.up, (sky - equator) * 1.2f, 1f);
            sh.AddDirectionalLight(Vector3.down, (ground - equator) * 0.6f, 1f);
            RenderSettings.ambientProbe = sh;
            RenderSettings.skybox = null;
            RenderSettings.fog = false;
        }

        private Camera SetupCamera()
        {
            var rig = new GameObject("CameraRig");
            _camera = rig.AddComponent<IsometricCameraController>();
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(rig.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = WorldPalette.Sky;
            cam.allowHDR = false;
            cam.allowMSAA = true;
            camGo.AddComponent<AudioListener>();
            return cam;
        }

        private static void EnsureEventSystem()
        {
            if (EventSystem.current != null) return;
            var go = new GameObject("EventSystem");
            go.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM && EMPIRE_INPUT_SYSTEM_PACKAGE
            go.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
#else
            go.AddComponent<StandaloneInputModule>();
#endif
        }

        private void Fail(string message)
        {
            _fatalError = message;
            Debug.LogError("[EmpireTycoon] " + message);
        }

        private void OnGUI()
        {
            if (_fatalError == null) return;
            var style = new GUIStyle(GUI.skin.label) { fontSize = 28, wordWrap = true };
            style.normal.textColor = Color.white;
            GUI.color = Color.white;
            GUI.Box(new Rect(20, 20, Screen.width - 40, 200), GUIContent.none);
            GUI.Label(new Rect(40, 40, Screen.width - 80, 160), "EMPIRE TYCOON — erro de inicialização:\n" + _fatalError, style);
        }
    }
}
