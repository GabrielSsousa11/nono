using System;
using System.Collections.Generic;
using EmpireTycoon.Runtime.Data;
using EmpireTycoon.Simulation.Buildings;
using EmpireTycoon.Simulation.Core;
using EmpireTycoon.Simulation.Session;
using EmpireTycoon.Simulation.WorldMap;
using UnityEngine;
using UnityEngine.Rendering;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>
    /// Representação 3D da cidade. Apenas observa a simulação (via EventBus) e nunca altera
    /// o estado do jogo. Gera chão, ruas, terrenos, estruturas de fundo e estabelecimentos.
    /// </summary>
    public sealed class CityView : MonoBehaviour
    {
        public const float GroundY = 0f;
        public const float SidewalkTop = 0.15f;
        public const float LotTop = 0.2f;
        private const float LotInset = 0.35f;
        private const float BuildingMargin = 1.0f;

        private GameSession _session;
        private GameDatabase _db;
        private MaterialLibrary _materials;
        private BuildingModelFactory _models;
        private CityGridMapping _map;

        private readonly Dictionary<int, LotView> _lots = new Dictionary<int, LotView>();
        private readonly HashSet<int> _busyLots = new HashSet<int>();
        private readonly List<IDisposable> _subscriptions = new List<IDisposable>();
        private readonly List<Mesh> _ownedMeshes = new List<Mesh>();
        private readonly Dictionary<string, ModelMesh> _helperMeshes = new Dictionary<string, ModelMesh>();
        private readonly MeshBuilder _builder = new MeshBuilder();
        private readonly List<GameObject> _releaseScratch = new List<GameObject>();
        private RendererPool _pool;

        /// <summary>Prédios mais altos que isso ganham LOD (versão simplificada quando ocupam pouco da tela).</summary>
        private const float LodMinHeight = 9f;

        private Mesh _unitTile;
        private Transform _lotsRoot;
        private Transform _selectionMarker;
        private Transform _selectionArrow;
        private float _selectionArrowBaseY;
        private int _selectedLotId = -1;

        public CityGridMapping Mapping => _map;
        public int SelectedLotId => _selectedLotId;

        private sealed class LotView
        {
            public Lot Lot;
            public GameObject Root;
            public MeshRenderer Tile;
            public GameObject OwnerFrame;
            public GameObject SaleSign;
            public GameObject Ambient;
            public GameObject Building;
            public GameObject Site;
            public Transform CraneJib;
            public int ShownBuildingId = Lot.NoBuilding;
            public int ShownLevel;
            public int ShownSiteState = -1;
            public AmbientStructure ShownAmbient;
            public int ShownAmbientFloors;
            public float AmbientHeight;
            public float TargetHeight;
            public Quaternion Facing;
            public Bounds PickBounds;
        }

        public void Initialize(GameSession session, GameDatabase db, MaterialLibrary materials, BuildingModelFactory models)
        {
            _session = session ?? throw new ArgumentNullException(nameof(session));
            _db = db;
            _materials = materials;
            _models = models;
            _map = new CityGridMapping(session.City.Width, session.City.Height, db.cellSize);
            var poolRoot = new GameObject("Pool").transform;
            poolRoot.SetParent(transform, false);
            _pool = new RendererPool(poolRoot);

            BuildTerrain();
            BuildRoadsAndBlocks();
            BuildOutskirtsNature();
            _unitTile = BuildMesh(b => b.AddBox(MaterialSlot.Ground, Vector3.zero, Vector3.one), "UnitTile").Mesh;

            _lotsRoot = new GameObject("Lots").transform;
            _lotsRoot.SetParent(transform, false);
            foreach (var lot in session.City.Lots) CreateLotView(lot);

            CreateSelectionMarker();

            _subscriptions.Add(session.Events.Subscribe<LotOwnershipChanged>(e => RefreshLot(e.LotId)));
            _subscriptions.Add(session.Events.Subscribe<BuildingPlaced>(e => RefreshLot(e.LotId)));
            _subscriptions.Add(session.Events.Subscribe<BuildingRemoved>(e => RefreshLot(e.LotId)));
            _subscriptions.Add(session.Events.Subscribe<BuildingStateChanged>(e =>
            {
                var b = session.GetBuilding(e.BuildingId);
                if (b != null) RefreshLot(b.LotId);
            }));
            _subscriptions.Add(session.Events.Subscribe<LotDevelopmentChanged>(e => RefreshLot(e.LotId)));
        }

        /// <summary>Estatística do pool (diagnóstico de desempenho).</summary>
        public string PoolStats => "renderers criados: " + _pool.CreatedCount + ", livres: " + _pool.FreeCount;

        private void OnDestroy()
        {
            foreach (var s in _subscriptions) s.Dispose();
            _subscriptions.Clear();
            foreach (var m in _ownedMeshes) if (m != null) Destroy(m);
            foreach (var m in _helperMeshes.Values) if (m.Mesh != null) Destroy(m.Mesh);
        }

        // ------------------------------------------------------------------ Atualização por frame

        private void Update()
        {
            if (_session == null) return;
            float t = Time.time;

            if (_busyLots.Count > 0)
            {
                float tickFrac = _session.Clock.Speed == GameSpeed.Paused ? 0f : _session.Clock.TickProgress;
                int devHours = Mathf.Max(1, _session.Config.Growth.DevelopmentHours);
                foreach (int lotId in _busyLots)
                {
                    var view = _lots[lotId];
                    var lot = view.Lot;
                    var b = _session.GetBuildingOnLot(lot);
                    if (b != null && view.Building != null && b.State == BuildingState.UnderConstruction)
                    {
                        float p = Mathf.Clamp01((b.WorkDoneHours + tickFrac) / Mathf.Max(1, b.WorkTotalHours));
                        SetHeightScale(view.Building, p);
                    }
                    else if (lot.IsUnderDevelopment && view.Ambient != null)
                    {
                        float p = Mathf.Clamp01((devHours - lot.DevelopmentHoursLeft + tickFrac) / devHours);
                        SetHeightScale(view.Ambient, p);
                    }
                    if (view.CraneJib != null)
                        view.CraneJib.localRotation = Quaternion.Euler(0f, Mathf.Sin(t * 0.35f + lotId) * 75f, 0f);
                }
            }

            if (_selectionArrow != null && _selectionMarker.gameObject.activeSelf)
            {
                var p = _selectionArrow.localPosition;
                p.y = _selectionArrowBaseY + Mathf.Sin(t * 3f) * 0.6f;
                _selectionArrow.localPosition = p;
                _selectionArrow.localRotation = Quaternion.Euler(0f, t * 60f, 0f);
            }
        }

        // ------------------------------------------------------------------ Seleção e picking

        /// <summary>Encontra o terreno sob o raio: primeiro os volumes dos edifícios, depois o chão.</summary>
        public Lot PickLot(Ray ray)
        {
            Lot best = null;
            float bestDist = float.MaxValue;
            foreach (var view in _lots.Values)
            {
                if (view.PickBounds.size.y < 1f) continue;
                if (view.PickBounds.IntersectRay(ray, out float d) && d < bestDist)
                {
                    bestDist = d;
                    best = view.Lot;
                }
            }

            var ground = new Plane(Vector3.up, new Vector3(0, LotTop, 0));
            if (ground.Raycast(ray, out float gd) && gd < bestDist && _map.WorldToCell(ray.GetPoint(gd), out var cell))
            {
                var lot = _session.City.GetLotAt(cell);
                if (lot != null) return lot;
            }
            return best;
        }

        public void SetSelectedLot(int lotId)
        {
            _selectedLotId = lotId;
            var lot = _session.City.GetLot(lotId);
            if (lot == null)
            {
                _selectionMarker.gameObject.SetActive(false);
                return;
            }

            _releaseScratch.Clear();
            foreach (Transform child in _selectionMarker) if (child != _selectionArrow) _releaseScratch.Add(child.gameObject);
            foreach (var go in _releaseScratch) _pool.Release(go);
            var size = _map.RectSize(lot.Rect);
            var frame = GetHelper("sel|" + size.x + "x" + size.y, b => b.AddFrame(MaterialSlot.Accent, Vector3.zero, size.x - 0.1f, size.y - 0.1f, 0.45f, 0.35f));
            CreateRenderer("Frame", _selectionMarker, frame, SelectionPalette(), ShadowCastingMode.Off);

            _selectionMarker.position = _map.RectCenter(lot.Rect) + Vector3.up * (LotTop + 0.02f);
            var view = _lots[lot.Id];
            float top = view.PickBounds.size.y > 0.5f ? view.PickBounds.max.y : LotTop + 2f;
            _selectionArrowBaseY = top + 3f;
            _selectionMarker.gameObject.SetActive(true);
        }

        private static ModelPalette SelectionPalette()
        {
            var p = ModelPalette.Create(WorldPalette.Selection, WorldPalette.Selection, WorldPalette.Selection);
            return p;
        }

        private void CreateSelectionMarker()
        {
            _selectionMarker = new GameObject("SelectionMarker").transform;
            _selectionMarker.SetParent(transform, false);
            var arrow = GetHelper("arrow", b =>
            {
                b.AddCone(MaterialSlot.Accent, new Vector3(0, 1.6f, 0), 1.0f, -1.6f, 4);
                b.AddBox(MaterialSlot.Accent, new Vector3(0, 1.6f, 0), new Vector3(0.6f, 1.4f, 0.6f));
            });
            _selectionArrow = CreateRenderer("Arrow", _selectionMarker, arrow, SelectionPalette(), ShadowCastingMode.On).transform;
            _selectionMarker.gameObject.SetActive(false);
        }

        // ------------------------------------------------------------------ Terrenos

        private void CreateLotView(Lot lot)
        {
            var center = _map.RectCenter(lot.Rect);
            var size = _map.RectSize(lot.Rect);
            var root = new GameObject("Lot_" + lot.Id);
            root.transform.SetParent(_lotsRoot, false);
            root.transform.position = center;

            bool southRoad = _session.City.GetCell(new GridCoord(lot.Rect.X, lot.Rect.Y - 1)) == CellType.Road;
            var view = new LotView
            {
                Lot = lot,
                Root = root,
                Facing = southRoad ? Quaternion.identity : Quaternion.Euler(0, 180f, 0),
            };

            var tile = new GameObject("Tile");
            tile.transform.SetParent(root.transform, false);
            tile.transform.localPosition = new Vector3(0, SidewalkTop, 0);
            tile.transform.localScale = new Vector3(size.x - LotInset * 2, LotTop - SidewalkTop, size.y - LotInset * 2);
            tile.AddComponent<MeshFilter>().sharedMesh = _unitTile;
            view.Tile = tile.AddComponent<MeshRenderer>();
            view.Tile.shadowCastingMode = ShadowCastingMode.Off;

            _lots.Add(lot.Id, view);
            RefreshLot(lot.Id);
        }

        private static string AmbientStyle(AmbientStructure type)
        {
            switch (type)
            {
                case AmbientStructure.House: return BuildingModelFactory.House;
                case AmbientStructure.Apartment: return BuildingModelFactory.Apartment;
                case AmbientStructure.OfficeTower: return BuildingModelFactory.OfficeTower;
                case AmbientStructure.Shop: return BuildingModelFactory.AmbientShop;
                case AmbientStructure.Warehouse: return BuildingModelFactory.AmbientWarehouse;
                case AmbientStructure.Park: return BuildingModelFactory.Park;
                default: return null;
            }
        }

        private GameObject CreateAmbient(LotView view)
        {
            var lot = view.Lot;
            string style = AmbientStyle(lot.Ambient);
            if (style == null) return null;
            int variant = lot.Ambient == AmbientStructure.Park ? lot.Id : lot.AmbientFloors;
            var go = CreateModel("Ambient_" + lot.Ambient, view.Root.transform, style, 1, Footprint(view), variant,
                WorldPalette.AmbientPalette(lot.Id, lot.Ambient), out float height);
            view.AmbientHeight = height;
            go.transform.localPosition = new Vector3(0, LotTop, 0);
            go.transform.localRotation = view.Facing;
            return go;
        }

        private void RefreshLot(int lotId)
        {
            if (!_lots.TryGetValue(lotId, out var view)) return;
            var lot = view.Lot;
            bool mine = lot.OwnerId == _session.Player.Id;
            var size = _map.RectSize(lot.Rect);

            view.Tile.sharedMaterial = _materials.Get(WorldPalette.LotGround(lot, mine));

            if (mine && view.OwnerFrame == null)
            {
                var frame = GetHelper("own|" + size.x + "x" + size.y, b =>
                {
                    b.AddFrame(MaterialSlot.Accent, Vector3.zero, size.x - LotInset * 2, size.y - LotInset * 2, 0.3f, 0.12f);
                    // Placa da empresa (poste + painel) no canto do terreno.
                    var c = new Vector3(size.x * 0.5f - 1.0f, 0, -size.y * 0.5f + 1.0f);
                    b.AddBox(MaterialSlot.Metal, c, new Vector3(0.15f, 2.2f, 0.15f));
                    b.AddBox(MaterialSlot.Accent, c + new Vector3(0, 1.6f, 0), new Vector3(1.4f, 0.8f, 0.1f));
                });
                var pal = ModelPalette.Create(WorldPalette.PlayerBrand, WorldPalette.PlayerBrand, WorldPalette.PlayerBrand);
                view.OwnerFrame = CreateRenderer("OwnerFrame", view.Root.transform, frame, pal, ShadowCastingMode.On);
                view.OwnerFrame.transform.localPosition = new Vector3(0, LotTop, 0);
                view.OwnerFrame.transform.localRotation = view.Facing;
            }
            if (view.OwnerFrame != null) view.OwnerFrame.SetActive(mine);

            bool showSale = lot.IsForSale && !lot.HasBuilding;
            if (showSale && view.SaleSign == null)
            {
                var sign = GetHelper("sale", b =>
                {
                    b.AddBox(MaterialSlot.Wall, new Vector3(-0.5f, 0, 0), new Vector3(0.12f, 1.8f, 0.12f));
                    b.AddBox(MaterialSlot.Wall, new Vector3(0.5f, 0, 0), new Vector3(0.12f, 1.8f, 0.12f));
                    b.AddBox(MaterialSlot.Accent, new Vector3(0, 1.0f, 0), new Vector3(1.6f, 0.9f, 0.08f));
                });
                var pal = ModelPalette.Create(WorldPalette.Wood, WorldPalette.Wood, new Color(0.95f, 0.95f, 0.93f));
                view.SaleSign = CreateRenderer("ForSaleSign", view.Root.transform, sign, pal, ShadowCastingMode.On);
                view.SaleSign.transform.localPosition = view.Facing * new Vector3(-size.x * 0.5f + 1.4f, LotTop, -size.y * 0.5f + 1.0f);
                view.SaleSign.transform.localRotation = view.Facing;
            }
            if (view.SaleSign != null) view.SaleSign.SetActive(showSale);

            RefreshStructures(view);
            UpdatePickBounds(view);
            if (lotId == _selectedLotId) SetSelectedLot(lotId);
        }

        // ------------------------------------------------------------------ Estabelecimentos

        /// <summary>Sincroniza estrutura de fundo, estabelecimento e canteiro de obras de um terreno.</summary>
        private void RefreshStructures(LotView view)
        {
            var lot = view.Lot;

            // Estruturas de fundo (inclui empreendimentos particulares do crescimento da cidade).
            if (lot.IsAmbient && (view.Ambient == null || view.ShownAmbient != lot.Ambient || view.ShownAmbientFloors != lot.AmbientFloors))
            {
                Release(ref view.Ambient);
                view.Ambient = CreateAmbient(view);
                view.ShownAmbient = lot.Ambient;
                view.ShownAmbientFloors = lot.AmbientFloors;
            }
            if (!lot.IsAmbient) Release(ref view.Ambient);
            if (view.Ambient != null && !lot.IsUnderDevelopment) view.Ambient.transform.localScale = Vector3.one;

            // Estabelecimento de uma empresa.
            var b = _session.GetBuildingOnLot(lot);
            if (b == null)
            {
                Release(ref view.Building);
                view.ShownBuildingId = Lot.NoBuilding;
            }
            else
            {
                if (view.Building == null || view.ShownBuildingId != b.Id || view.ShownLevel != b.Level)
                {
                    Release(ref view.Building);
                    view.Building = CreateBuildingModel(b, view);
                    view.ShownBuildingId = b.Id;
                    view.ShownLevel = b.Level;
                }
                if (b.State == BuildingState.Operational) view.Building.transform.localScale = Vector3.one;
            }

            // Canteiro de obras (estabelecimento em obra/reforma ou empreendimento particular).
            bool busy = (b != null && b.IsBusy) || lot.IsUnderDevelopment;
            int siteState = b != null ? (int)b.State : lot.IsUnderDevelopment ? 100 : -1;
            if (busy && (view.Site == null || view.ShownSiteState != siteState))
            {
                Release(ref view.Site);
                float h = b != null
                    ? (b.State == BuildingState.Upgrading ? EstimateHeight(b, b.Level + 1, view) : view.TargetHeight)
                    : view.AmbientHeight;
                view.Site = CreateConstructionSite(view, Mathf.Max(h, 3f));
            }
            if (!busy && view.Site != null)
            {
                Release(ref view.Site);
                view.CraneJib = null;
            }
            view.ShownSiteState = siteState;

            if (busy) _busyLots.Add(lot.Id);
            else _busyLots.Remove(lot.Id);
        }

        private void Release(ref GameObject go)
        {
            if (go == null) return;
            _pool.Release(go);
            go = null;
        }

        private static void SetHeightScale(GameObject go, float progress01)
        {
            var s = go.transform.localScale;
            go.transform.localScale = new Vector3(s.x, Mathf.Lerp(0.03f, 1f, progress01), s.z);
        }

        private Vector2 Footprint(LotView view)
        {
            var size = _map.RectSize(view.Lot.Rect);
            return new Vector2(size.x - BuildingMargin * 2, size.y - BuildingMargin * 2);
        }

        private float EstimateHeight(BuildingInstance b, int level, LotView view)
        {
            var asset = _db.FindAsset(b.Definition.Id);
            if (asset != null && asset.modelPrefab != null) return view.TargetHeight;
            return _models.Get(b.Definition.VisualKey, Mathf.Min(level, b.Definition.MaxLevel), Footprint(view), 0).Height;
        }

        private GameObject CreateBuildingModel(BuildingInstance b, LotView view)
        {
            var asset = _db.FindAsset(b.Definition.Id);
            GameObject go;
            if (asset != null && asset.modelPrefab != null)
            {
                go = Instantiate(asset.modelPrefab, view.Root.transform, false);
                go.name = "Building_" + b.Definition.Id;
                var renderers = go.GetComponentsInChildren<Renderer>();
                float h = 4f;
                foreach (var r in renderers) h = Mathf.Max(h, r.bounds.max.y);
                view.TargetHeight = h;
            }
            else
            {
                var palette = asset != null
                    ? ModelPalette.Create(asset.wallColor, asset.roofColor, asset.accentColor)
                    : ModelPalette.Create(Color.white, Color.gray, WorldPalette.PlayerBrand);
                go = CreateModel("Building_" + b.Definition.Id, view.Root.transform, b.Definition.VisualKey, b.Level, Footprint(view), 0, palette, out float height);
                view.TargetHeight = height;
            }
            go.transform.localPosition = new Vector3(0, LotTop, 0);
            go.transform.localRotation = view.Facing;
            return go;
        }

        private GameObject CreateConstructionSite(LotView view, float height)
        {
            var fp = Footprint(view);
            float w = fp.x * 0.95f, d = fp.y * 0.85f;
            string key = "site|" + w.ToString("0.0") + "x" + d.ToString("0.0") + "x" + height.ToString("0.0");
            var scaffold = GetHelper(key, b =>
            {
                b.AddBox(MaterialSlot.Ground, Vector3.zero, new Vector3(fp.x + 1.0f, 0.04f, fp.y + 1.0f));
                float hw = w * 0.5f, hd = d * 0.5f;
                int nx = Mathf.Max(2, Mathf.RoundToInt(w / 3f)), nz = Mathf.Max(2, Mathf.RoundToInt(d / 3f));
                for (int i = 0; i <= nx; i++)
                {
                    float x = -hw + w * i / nx;
                    b.AddBox(MaterialSlot.Metal, new Vector3(x, 0, -hd), new Vector3(0.12f, height, 0.12f));
                    b.AddBox(MaterialSlot.Metal, new Vector3(x, 0, hd), new Vector3(0.12f, height, 0.12f));
                }
                for (int i = 1; i < nz; i++)
                {
                    float z = -hd + d * i / nz;
                    b.AddBox(MaterialSlot.Metal, new Vector3(-hw, 0, z), new Vector3(0.12f, height, 0.12f));
                    b.AddBox(MaterialSlot.Metal, new Vector3(hw, 0, z), new Vector3(0.12f, height, 0.12f));
                }
                for (float y = 2f; y <= height; y += 2f)
                {
                    b.AddFrame(MaterialSlot.Wall, new Vector3(0, y, 0), w + 0.5f, d + 0.5f, 0.5f, 0.1f);
                    b.AddFrame(MaterialSlot.Accent, new Vector3(0, y + 0.9f, 0), w + 0.5f, d + 0.5f, 0.06f, 0.08f);
                }
                // Contêiner do canteiro e pilha de material.
                b.AddBox(MaterialSlot.Accent, new Vector3(-fp.x * 0.5f + 1.2f, 0, -fp.y * 0.5f - 0.2f), new Vector3(2.2f, 1.1f, 1.0f));
                b.AddBox(MaterialSlot.Wall, new Vector3(fp.x * 0.5f - 1.0f, 0, -fp.y * 0.5f - 0.2f), new Vector3(1.4f, 0.6f, 0.9f));
            });
            var pal = ModelPalette.Create(WorldPalette.Wood, WorldPalette.Wood, WorldPalette.SafetyOrange);
            pal.Ground = WorldPalette.ConstructionDirt;
            var site = CreateRenderer("ConstructionSite", view.Root.transform, scaffold, pal, ShadowCastingMode.On);
            site.transform.localPosition = new Vector3(0, LotTop, 0);
            site.transform.localRotation = view.Facing;

            // Guindaste de torre com lança animada.
            float mastH = Mathf.Max(height + 5f, 12f);
            var mast = GetHelper("crane_mast|" + mastH.ToString("0.0"), b =>
            {
                b.AddBox(MaterialSlot.Accent, Vector3.zero, new Vector3(0.8f, mastH, 0.8f));
                b.AddBox(MaterialSlot.Trim, Vector3.zero, new Vector3(1.6f, 0.6f, 1.6f));
            });
            var cranePal = ModelPalette.Create(WorldPalette.CraneYellow, WorldPalette.CraneYellow, WorldPalette.CraneYellow);
            var mastGo = CreateRenderer("CraneMast", site.transform, mast, cranePal, ShadowCastingMode.On);
            mastGo.transform.localPosition = new Vector3(fp.x * 0.5f + 0.2f, 0, fp.y * 0.5f + 0.2f);

            var jib = GetHelper("crane_jib", b =>
            {
                b.AddBox(MaterialSlot.Accent, new Vector3(-4f, 0, 0), new Vector3(14f, 0.6f, 0.6f));
                b.AddBox(MaterialSlot.Trim, new Vector3(2.6f, -0.8f, 0), new Vector3(1.4f, 1.0f, 1.0f));
                b.AddBox(MaterialSlot.Accent, new Vector3(0, 0.6f, 0), new Vector3(0.8f, 1.2f, 0.8f));
                b.AddBox(MaterialSlot.Metal, new Vector3(-9f, -3.5f, 0), new Vector3(0.05f, 3.5f, 0.05f));
                b.AddBox(MaterialSlot.Trim, new Vector3(-9f, -3.9f, 0), new Vector3(0.6f, 0.4f, 0.6f));
            });
            var jibGo = CreateRenderer("CraneJib", mastGo.transform, jib, cranePal, ShadowCastingMode.On);
            jibGo.transform.localPosition = new Vector3(0, mastH, 0);
            view.CraneJib = jibGo.transform;
            return site;
        }

        private void UpdatePickBounds(LotView view)
        {
            var b = new Bounds(view.Root.transform.position + Vector3.up * LotTop, Vector3.zero);
            bool any = false;
            foreach (var go in new[] { view.Building, view.Ambient })
            {
                if (go == null || view.Lot.Ambient == AmbientStructure.Park && go == view.Ambient) continue;
                foreach (var r in go.GetComponentsInChildren<Renderer>())
                {
                    if (!any) { b = r.bounds; any = true; }
                    else b.Encapsulate(r.bounds);
                }
            }
            if (view.Building != null && view.TargetHeight > 0)
            {
                // Durante a obra, o volume clicável é o do edifício final.
                var top = view.Root.transform.position + Vector3.up * (LotTop + view.TargetHeight);
                if (!any) { b = new Bounds(top, Vector3.zero); any = true; }
                b.Encapsulate(top);
            }
            view.PickBounds = any ? b : new Bounds(view.Root.transform.position, Vector3.zero);
        }

        // ------------------------------------------------------------------ Terreno, ruas e natureza

        private void BuildTerrain()
        {
            var bounds = _map.WorldBounds;
            float margin = 240f;
            float hx = bounds.extents.x + margin, hz = bounds.extents.z + margin;
            var model = BuildMesh(b => b.AddQuad(MaterialSlot.Foliage,
                new Vector3(-hx, GroundY - 0.02f, -hz), new Vector3(-hx, GroundY - 0.02f, hz),
                new Vector3(hx, GroundY - 0.02f, hz), new Vector3(hx, GroundY - 0.02f, -hz), Vector3.up), "Terrain");
            var pal = ModelPalette.Create(Color.white, Color.white, Color.white);
            pal.Foliage = WorldPalette.Grass;
            var go = CreateRenderer("Terrain", transform, model, pal, ShadowCastingMode.Off);
            go.isStatic = true;
        }

        private void BuildRoadsAndBlocks()
        {
            var city = _session.City;
            int stride = _session.CityLayout.BlockSize + 1;
            float cs = _map.CellSize;

            var model = BuildMesh(b =>
            {
                for (int y = 0; y < city.Height; y++)
                for (int x = 0; x < city.Width; x++)
                {
                    if (city.GetCell(new GridCoord(x, y)) != CellType.Road) continue;
                    var c = _map.GridToWorld(x + 0.5f, y + 0.5f);
                    float h = cs * 0.5f;
                    b.AddQuad(MaterialSlot.Trim, c + new Vector3(-h, 0.02f, -h), c + new Vector3(-h, 0.02f, h), c + new Vector3(h, 0.02f, h), c + new Vector3(h, 0.02f, -h), Vector3.up);

                    bool horizontal = y % stride == 0, vertical = x % stride == 0;
                    if (horizontal && vertical) continue; // cruzamento
                    int along = horizontal ? x % stride : y % stride;
                    bool nearCrossing = along == 1 || along == stride - 1;
                    if (nearCrossing)
                    {
                        // Faixa de pedestres.
                        for (int i = 0; i < 4; i++)
                        {
                            float o = -1.2f + i * 0.8f;
                            var sc = horizontal ? new Vector3(0, 0.03f, o) : new Vector3(o, 0.03f, 0);
                            var size = horizontal ? new Vector3(cs * 0.4f, 0.01f, 0.4f) : new Vector3(0.4f, 0.01f, cs * 0.4f);
                            b.AddBox(MaterialSlot.Wall, c + sc, size);
                        }
                    }
                    else
                    {
                        var size = horizontal ? new Vector3(cs * 0.5f, 0.01f, 0.15f) : new Vector3(0.15f, 0.01f, cs * 0.5f);
                        b.AddBox(MaterialSlot.Wall, c + new Vector3(0, 0.02f, 0), size);
                    }
                }

                // Calçadas: um bloco elevado por quarteirão.
                int bs = _session.CityLayout.BlockSize;
                for (int by = 0; by < _session.CityLayout.BlocksY; by++)
                for (int bx = 0; bx < _session.CityLayout.BlocksX; bx++)
                {
                    var center = _map.GridToWorld(bx * stride + 1 + bs * 0.5f, by * stride + 1 + bs * 0.5f);
                    b.AddBox(MaterialSlot.Ground, center, new Vector3(bs * cs, SidewalkTop, bs * cs));
                }
            }, "RoadsAndBlocks");

            var pal = ModelPalette.Create(WorldPalette.RoadMarking, WorldPalette.Asphalt, WorldPalette.Selection);
            pal.Trim = WorldPalette.Asphalt;
            pal.Ground = WorldPalette.Sidewalk;
            var go = CreateRenderer("RoadsAndBlocks", transform, model, pal, ShadowCastingMode.Off);
            go.isStatic = true;
        }

        private void BuildOutskirtsNature()
        {
            var rng = new DeterministicRandom(_session.CityLayout.Seed ^ 0xA5A5UL);
            var bounds = _map.WorldBounds;
            float inner = Mathf.Max(bounds.extents.x, bounds.extents.z) + 6f;
            float outer = inner + 70f;
            var model = BuildMesh(b =>
            {
                for (int i = 0; i < 160; i++)
                {
                    float angle = (float)rng.Range(0.0, Math.PI * 2);
                    float radius = (float)rng.Range(inner, outer);
                    var p = new Vector3(Mathf.Cos(angle) * radius, 0, Mathf.Sin(angle) * radius);
                    if (Mathf.Abs(p.x) < bounds.extents.x + 4f && Mathf.Abs(p.z) < bounds.extents.z + 4f) continue;
                    float s = (float)rng.Range(0.9, 1.8);
                    b.AddCylinder(MaterialSlot.Trim, p, 0.2f * s, 1.6f * s, 5);
                    b.AddCone(MaterialSlot.Foliage, p + Vector3.up * 1.2f * s, 1.4f * s, 2.6f * s, 6);
                    b.AddCone(MaterialSlot.Foliage, p + Vector3.up * 2.5f * s, 1.0f * s, 2.0f * s, 6);
                }
            }, "OutskirtsTrees");
            var pal = ModelPalette.Create(Color.white, Color.white, Color.white);
            pal.Trim = new Color(0.4f, 0.3f, 0.22f);
            pal.Foliage = new Color(0.28f, 0.52f, 0.28f);
            var go = CreateRenderer("OutskirtsTrees", transform, model, pal, ShadowCastingMode.On);
            go.isStatic = true;
        }

        // ------------------------------------------------------------------ Utilitários

        private ModelMesh BuildMesh(Action<MeshBuilder> build, string name)
        {
            _builder.Clear();
            build(_builder);
            var mesh = _builder.Build(name, out var slots);
            _ownedMeshes.Add(mesh);
            return new ModelMesh { Mesh = mesh, Slots = slots };
        }

        private ModelMesh GetHelper(string key, Action<MeshBuilder> build)
        {
            if (_helperMeshes.TryGetValue(key, out var m)) return m;
            _builder.Clear();
            build(_builder);
            var mesh = _builder.Build("Helper_" + key, out var slots);
            m = new ModelMesh { Mesh = mesh, Slots = slots };
            _helperMeshes.Add(key, m);
            return m;
        }

        private GameObject CreateRenderer(string name, Transform parent, ModelMesh model, ModelPalette palette, ShadowCastingMode shadows)
        {
            return _pool.Get(name, parent, model.Mesh, _materials.ForSlots(model.Slots, palette), shadows);
        }

        /// <summary>Instancia um modelo procedural; prédios altos recebem LODGroup com versão simplificada.</summary>
        private GameObject CreateModel(string name, Transform parent, string style, int level, Vector2 footprint, int variant, ModelPalette palette, out float height)
        {
            var detailed = _models.Get(style, level, footprint, variant);
            height = detailed.Height;
            if (height < LodMinHeight || !BuildingModelFactory.SupportsLod(style)) return CreateRenderer(name, parent, detailed, palette, ShadowCastingMode.On);

            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            var lod0 = CreateRenderer("LOD0", root.transform, detailed, palette, ShadowCastingMode.On);
            var lod1 = CreateRenderer("LOD1", root.transform, _models.GetLod(style, level, footprint, variant), palette, ShadowCastingMode.On);
            var group = root.AddComponent<LODGroup>();
            group.SetLODs(new[]
            {
                new LOD(0.14f, new Renderer[] { lod0.GetComponent<MeshRenderer>() }),
                new LOD(0.01f, new Renderer[] { lod1.GetComponent<MeshRenderer>() }),
            });
            group.RecalculateBounds();
            return root;
        }
    }
}
