using System.Collections.Generic;
using UnityEngine;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Malha gerada + lista de materiais (um por submesh).</summary>
    public sealed class ModelMesh
    {
        public Mesh Mesh;
        public MaterialSlot[] Slots;
        public float Height => Mesh.bounds.max.y;
    }

    /// <summary>
    /// Gera modelos low-poly estilizados de forma procedural, com fachadas, janelas, telhados,
    /// toldos, chaminés etc. É o conteúdo visual provisório até a entrega dos modelos do Blender
    /// (ver Docs/ART_PIPELINE.md): definir <c>modelPrefab</c> no BuildingDefinitionAsset substitui
    /// estes modelos sem alterar nenhum outro sistema.
    /// Convenção: origem no centro do terreno, base em y = 0, fachada principal voltada para -Z.
    /// </summary>
    public sealed class BuildingModelFactory
    {
        private readonly Dictionary<string, ModelMesh> _cache = new Dictionary<string, ModelMesh>();
        private readonly MeshBuilder _b = new MeshBuilder();

        public const string Park = "amb_park";
        public const string House = "amb_house";
        public const string Apartment = "amb_apartment";
        public const string OfficeTower = "amb_office_tower";
        public const string AmbientShop = "amb_shop";
        public const string AmbientWarehouse = "amb_warehouse";

        /// <param name="style">Chave do estilo (visualKey da definição ou estilo ambiente).</param>
        /// <param name="level">Nível do edifício (1..N) — altera porte/andares.</param>
        /// <param name="footprint">Área útil em metros (X = largura da fachada, Y = profundidade).</param>
        /// <param name="variant">Variação determinística (andares de prédios ambientes, sementes).</param>
        public ModelMesh Get(string style, int level, Vector2 footprint, int variant)
        {
            string key = style + "|" + level + "|" + footprint.x.ToString("0.0") + "x" + footprint.y.ToString("0.0") + "|" + variant;
            if (_cache.TryGetValue(key, out var cached)) return cached;

            _b.Clear();
            switch (style)
            {
                case "grocery": Grocery(level, footprint, false); break;
                case "bakery": Bakery(level, footprint); break;
                case "office": Office(level, footprint); break;
                case "factory": Factory(level, footprint); break;
                case "warehouse": Warehouse(level, footprint); break;
                case House: AmbientHouse(variant, footprint); break;
                case Apartment: AmbientApartment(variant, footprint); break;
                case OfficeTower: AmbientTower(variant, footprint); break;
                case AmbientShop: Grocery(Mathf.Clamp(variant, 1, 3), footprint, true); break;
                case AmbientWarehouse: Warehouse(1, footprint); break;
                case Park: ParkModel(variant, footprint); break;
                default:
                    Debug.LogWarning("[EmpireTycoon] Estilo visual desconhecido '" + style + "', usando 'grocery'.");
                    Grocery(level, footprint, false);
                    break;
            }

            var mesh = _b.Build("Model_" + key, out var slots);
            var model = new ModelMesh { Mesh = mesh, Slots = slots };
            _cache.Add(key, model);
            return model;
        }

        public void DestroyAll()
        {
            foreach (var m in _cache.Values) Object.Destroy(m.Mesh);
            _cache.Clear();
        }

        // ------------------------------------------------------------------ Auxiliares

        private enum Face { Front, Back, Left, Right }

        /// <summary>Fileira de janelas em uma face de um bloco (centro da base + tamanho).</summary>
        private void Windows(Face face, Vector3 bodyBase, Vector3 bodySize, float y, int count, float w, float h, MaterialSlot slot = MaterialSlot.Glass)
        {
            if (count <= 0) return;
            bool alongX = face == Face.Front || face == Face.Back;
            float span = alongX ? bodySize.x : bodySize.z;
            float step = span / count;
            const float depth = 0.14f;
            for (int i = 0; i < count; i++)
            {
                float t = -span * 0.5f + step * (i + 0.5f);
                Vector3 c;
                Vector3 size;
                switch (face)
                {
                    case Face.Front: c = new Vector3(bodyBase.x + t, y, bodyBase.z - bodySize.z * 0.5f); size = new Vector3(w, h, depth); break;
                    case Face.Back: c = new Vector3(bodyBase.x + t, y, bodyBase.z + bodySize.z * 0.5f); size = new Vector3(w, h, depth); break;
                    case Face.Left: c = new Vector3(bodyBase.x - bodySize.x * 0.5f, y, bodyBase.z + t); size = new Vector3(depth, h, w); break;
                    default: c = new Vector3(bodyBase.x + bodySize.x * 0.5f, y, bodyBase.z + t); size = new Vector3(depth, h, w); break;
                }
                _b.AddBox(slot, c, size);
            }
        }

        private void WindowGrid(Vector3 bodyBase, Vector3 size, int floors, float floorH, int firstFloor, bool allSides, float winW = 1.1f, float winH = 1.5f)
        {
            int countX = Mathf.Max(1, Mathf.FloorToInt(size.x / 2.4f));
            int countZ = Mathf.Max(1, Mathf.FloorToInt(size.z / 2.4f));
            for (int f = firstFloor; f < floors; f++)
            {
                float y = bodyBase.y + f * floorH + floorH * 0.3f;
                Windows(Face.Front, bodyBase, size, y, countX, winW, winH);
                if (!allSides) continue;
                Windows(Face.Back, bodyBase, size, y, countX, winW, winH);
                Windows(Face.Left, bodyBase, size, y, countZ, winW, winH);
                Windows(Face.Right, bodyBase, size, y, countZ, winW, winH);
            }
        }

        private void Tree(Vector3 pos, float scale)
        {
            _b.AddCylinder(MaterialSlot.Trim, pos, 0.18f * scale, 1.6f * scale, 6);
            _b.AddCone(MaterialSlot.Foliage, pos + Vector3.up * 1.2f * scale, 1.3f * scale, 2.4f * scale, 7);
            _b.AddCone(MaterialSlot.Foliage, pos + Vector3.up * 2.4f * scale, 0.95f * scale, 1.9f * scale, 7);
        }

        private void Awning(Vector3 frontCenter, float width, float yTop, float depth, bool striped)
        {
            float yLow = yTop - 0.55f;
            float z0 = frontCenter.z, z1 = frontCenter.z - depth;
            int stripes = striped ? Mathf.Max(3, Mathf.RoundToInt(width / 0.8f)) : 1;
            float sw = width / stripes;
            for (int i = 0; i < stripes; i++)
            {
                float x0 = frontCenter.x - width * 0.5f + i * sw, x1 = x0 + sw;
                var slot = striped && (i % 2 == 1) ? MaterialSlot.Wall : MaterialSlot.Accent;
                _b.AddQuad(slot, new Vector3(x0, yTop, z0), new Vector3(x1, yTop, z0), new Vector3(x1, yLow, z1), new Vector3(x0, yLow, z1), new Vector3(0, 1, -0.6f));
                _b.AddQuad(slot, new Vector3(x0, yTop, z0), new Vector3(x0, yLow, z1), new Vector3(x1, yLow, z1), new Vector3(x1, yTop, z0), new Vector3(0, -1, 0.6f));
                _b.AddBox(slot, new Vector3((x0 + x1) * 0.5f, yLow - 0.35f, z1), new Vector3(sw, 0.35f, 0.06f));
            }
        }

        // ------------------------------------------------------------------ Estabelecimentos do jogador

        private void Grocery(int level, Vector2 fp, bool ambient)
        {
            int floors = Mathf.Clamp(level, 1, 4);
            const float floorH = 3.6f;
            var size = new Vector3(fp.x * 0.9f, floors * floorH, fp.y * 0.72f);
            var bodyBase = new Vector3(0, 0, fp.y * 0.1f);
            float frontZ = bodyBase.z - size.z * 0.5f;

            _b.AddBox(MaterialSlot.Wall, bodyBase, size, topSlot: MaterialSlot.Roof);
            _b.AddFrame(MaterialSlot.Trim, bodyBase + Vector3.up * size.y, size.x, size.z, 0.25f, 0.55f);

            // Vitrine térrea com porta central.
            float glassW = (size.x - 1.6f) * 0.5f - 0.3f;
            _b.AddBox(MaterialSlot.Glass, new Vector3(-0.8f - glassW * 0.5f - 0.15f, 0.35f, frontZ), new Vector3(glassW, 2.4f, 0.16f));
            _b.AddBox(MaterialSlot.Glass, new Vector3(0.8f + glassW * 0.5f + 0.15f, 0.35f, frontZ), new Vector3(glassW, 2.4f, 0.16f));
            _b.AddBox(MaterialSlot.Trim, new Vector3(0, 0, frontZ), new Vector3(1.5f, 2.6f, 0.2f));
            Awning(new Vector3(0, 0, frontZ), size.x * 0.92f, 3.25f, 1.5f, striped: !ambient);

            // Letreiro.
            _b.AddBox(MaterialSlot.Accent, new Vector3(0, size.y, frontZ + 0.3f), new Vector3(size.x * 0.55f, 1.1f, 0.25f));
            _b.AddBox(MaterialSlot.Wall, new Vector3(0, size.y + 0.2f, frontZ + 0.17f), new Vector3(size.x * 0.45f, 0.7f, 0.05f));

            if (floors > 1) WindowGrid(bodyBase, size, floors, floorH, 1, allSides: true);
            Windows(Face.Left, bodyBase, size, 0.9f, Mathf.Max(1, Mathf.FloorToInt(size.z / 3f)), 1.2f, 1.4f);
            Windows(Face.Right, bodyBase, size, 0.9f, Mathf.Max(1, Mathf.FloorToInt(size.z / 3f)), 1.2f, 1.4f);

            // Equipamentos no telhado.
            _b.AddBox(MaterialSlot.Metal, bodyBase + new Vector3(size.x * 0.25f, size.y, size.z * 0.2f), new Vector3(1.4f, 0.9f, 1.1f));
            if (level >= 2) _b.AddBox(MaterialSlot.Metal, bodyBase + new Vector3(-size.x * 0.2f, size.y, size.z * 0.25f), new Vector3(1.1f, 0.8f, 1.1f));
        }

        private void Bakery(int level, Vector2 fp)
        {
            int floors = Mathf.Clamp(level, 1, 3);
            const float floorH = 3.3f;
            var size = new Vector3(fp.x * 0.78f, floors * floorH, fp.y * 0.6f);
            var bodyBase = new Vector3(0, 0, fp.y * 0.08f);
            float frontZ = bodyBase.z - size.z * 0.5f;

            _b.AddBox(MaterialSlot.Wall, bodyBase, size);
            _b.AddGableRoof(MaterialSlot.Roof, MaterialSlot.Wall, bodyBase + Vector3.up * size.y, size.x, size.z, 2.4f, 0.45f);
            // Chaminé do forno.
            _b.AddBox(MaterialSlot.Trim, bodyBase + new Vector3(size.x * 0.3f, size.y, size.z * 0.18f), new Vector3(0.8f, 3.4f, 0.8f));
            _b.AddBox(MaterialSlot.Metal, bodyBase + new Vector3(size.x * 0.3f, size.y + 3.4f, size.z * 0.18f), new Vector3(1.0f, 0.25f, 1.0f));

            _b.AddBox(MaterialSlot.Trim, new Vector3(-size.x * 0.25f, 0, frontZ), new Vector3(1.3f, 2.5f, 0.2f));
            _b.AddBox(MaterialSlot.Glass, new Vector3(size.x * 0.15f, 0.6f, frontZ), new Vector3(size.x * 0.45f, 1.9f, 0.16f));
            _b.AddBox(MaterialSlot.Trim, new Vector3(size.x * 0.15f, 0.5f, frontZ - 0.05f), new Vector3(size.x * 0.48f, 0.12f, 0.2f));
            Awning(new Vector3(0, 0, frontZ), size.x * 0.95f, 3.0f, 1.2f, striped: true);
            // Placa redonda (octógono baixo) pendurada.
            _b.AddCylinder(MaterialSlot.Accent, new Vector3(-size.x * 0.5f - 0.35f, 2.8f, frontZ + 0.6f), 0.45f, 0.12f, 8);
            if (floors > 1) WindowGrid(bodyBase, size, floors, floorH, 1, allSides: false, 1.0f, 1.3f);
            Windows(Face.Left, bodyBase, size, 0.9f, 2, 1.0f, 1.3f);
            Windows(Face.Right, bodyBase, size, 0.9f, 2, 1.0f, 1.3f);
        }

        private void Office(int level, Vector2 fp)
        {
            int floors = 3 + 3 * (Mathf.Clamp(level, 1, 5) - 1);
            OfficeBody(fp, floors, 0.76f, 0.76f, withLogo: true);
        }

        private void OfficeBody(Vector2 fp, int floors, float wRatio, float dRatio, bool withLogo)
        {
            const float floorH = 3.4f;
            float w = fp.x * wRatio, d = fp.y * dRatio;
            // Térreo com pé-direito duplo envidraçado.
            _b.AddBox(MaterialSlot.Glass, Vector3.zero, new Vector3(w - 0.6f, 4.2f, d - 0.6f));
            _b.AddBox(MaterialSlot.Trim, new Vector3(0, 0, -d * 0.5f + 0.2f), new Vector3(2.2f, 3.0f, 0.3f));
            float y = 4.2f;
            for (int f = 1; f < floors; f++)
            {
                _b.AddBox(MaterialSlot.Wall, new Vector3(0, y, 0), new Vector3(w, floorH * 0.32f, d));
                _b.AddBox(MaterialSlot.Glass, new Vector3(0, y + floorH * 0.32f, 0), new Vector3(w - 0.25f, floorH * 0.68f, d - 0.25f));
                y += floorH;
            }
            _b.AddBox(MaterialSlot.Wall, new Vector3(0, y, 0), new Vector3(w + 0.2f, 0.9f, d + 0.2f), topSlot: MaterialSlot.Roof);
            y += 0.9f;
            // Pilares de canto.
            float hx = w * 0.5f, hz = d * 0.5f;
            foreach (var c in new[] { new Vector3(-hx, 0, -hz), new Vector3(hx, 0, -hz), new Vector3(-hx, 0, hz), new Vector3(hx, 0, hz) })
                _b.AddBox(MaterialSlot.Wall, c, new Vector3(0.45f, y, 0.45f));
            // Cobertura técnica.
            _b.AddBox(MaterialSlot.Metal, new Vector3(w * 0.15f, y, d * 0.1f), new Vector3(w * 0.35f, 1.6f, d * 0.35f));
            _b.AddCylinder(MaterialSlot.Metal, new Vector3(-w * 0.25f, y, -d * 0.2f), 0.08f, 4.5f, 5);
            if (withLogo) _b.AddBox(MaterialSlot.Accent, new Vector3(0, y - 2.6f, -d * 0.5f - 0.15f), new Vector3(w * 0.5f, 1.4f, 0.2f));
        }

        private void Factory(int level, Vector2 fp)
        {
            level = Mathf.Clamp(level, 1, 5);
            // Galpão principal com telhado em dente de serra.
            float hallW = fp.x * 0.6f, hallD = fp.y * 0.86f, hallH = 5.5f + level * 0.5f;
            var hallBase = new Vector3(-fp.x * 0.18f, 0, 0);
            _b.AddBox(MaterialSlot.Wall, hallBase, new Vector3(hallW, hallH, hallD));
            int teeth = 4;
            float toothD = hallD / teeth;
            for (int i = 0; i < teeth; i++)
            {
                float z = hallBase.z - hallD * 0.5f + toothD * (i + 0.5f);
                _b.AddSawtooth(MaterialSlot.Roof, MaterialSlot.Glass, new Vector3(hallBase.x, hallH, z), hallW, toothD, 1.8f);
            }
            float frontZ = -hallD * 0.5f;
            // Portões de carga.
            for (int i = 0; i < 2; i++)
                _b.AddBox(MaterialSlot.Trim, new Vector3(hallBase.x - hallW * 0.25f + i * hallW * 0.5f, 0, frontZ), new Vector3(3.2f, 3.8f, 0.2f));
            _b.AddBox(MaterialSlot.Accent, new Vector3(hallBase.x, hallH - 1.0f, frontZ - 0.05f), new Vector3(hallW, 0.5f, 0.12f));
            Windows(Face.Left, hallBase, new Vector3(hallW, hallH, hallD), 2.6f, 4, 1.4f, 1.4f);

            // Bloco administrativo.
            float offW = fp.x * 0.26f, offD = fp.y * 0.48f, offH = 3.2f * (1 + Mathf.Min(level, 3) / 2);
            var offBase = new Vector3(fp.x * 0.33f, 0, -fp.y * 0.18f);
            var offSize = new Vector3(offW, offH, offD);
            _b.AddBox(MaterialSlot.Wall, offBase, offSize, topSlot: MaterialSlot.Roof);
            WindowGrid(offBase, offSize, Mathf.RoundToInt(offH / 3.2f), 3.2f, 0, allSides: true, 1.0f, 1.3f);

            // Chaminés (uma por nível, até 3) e tanques.
            int stacks = Mathf.Min(level, 3);
            for (int i = 0; i < stacks; i++)
            {
                var p = new Vector3(hallBase.x + hallW * 0.5f + 1.2f, 0, hallD * 0.3f - i * 2.4f);
                float h = 13f + i * 2f;
                _b.AddCylinder(MaterialSlot.Metal, p, 0.65f, h, 10);
                _b.AddCylinder(MaterialSlot.Accent, p + Vector3.up * (h - 1.6f), 0.7f, 0.6f, 10, capTop: false);
                _b.AddCylinder(MaterialSlot.Trim, p + Vector3.up * h, 0.72f, 0.3f, 10);
            }
            int tanks = 1 + level / 2;
            for (int i = 0; i < tanks; i++)
            {
                var p = new Vector3(fp.x * 0.43f - (i % 2) * 2.8f, 0, fp.y * 0.28f);
                _b.AddCylinder(MaterialSlot.Metal, p, 1.15f, 3.6f, 10);
                _b.AddCone(MaterialSlot.Metal, p + Vector3.up * 3.6f, 1.15f, 0.5f, 10);
            }
            // Esteira/tubulação entre galpão e tanques.
            _b.AddBox(MaterialSlot.Metal, new Vector3(fp.x * 0.25f, 3.2f, fp.y * 0.28f), new Vector3(fp.x * 0.22f, 0.4f, 0.4f));
        }

        private void Warehouse(int level, Vector2 fp)
        {
            level = Mathf.Clamp(level, 1, 5);
            var size = new Vector3(fp.x * 0.86f, 5.5f + level, fp.y * 0.72f);
            var bodyBase = new Vector3(0, 0, fp.y * 0.1f);
            float frontZ = bodyBase.z - size.z * 0.5f;
            _b.AddBox(MaterialSlot.Wall, bodyBase, size);
            _b.AddGableRoof(MaterialSlot.Roof, MaterialSlot.Wall, bodyBase + Vector3.up * size.y, size.x, size.z, 1.4f, 0.35f);
            int doors = 2 + level;
            float spacing = size.x / doors;
            for (int i = 0; i < doors; i++)
            {
                float x = -size.x * 0.5f + spacing * (i + 0.5f);
                _b.AddBox(MaterialSlot.Trim, new Vector3(x, 1.1f, frontZ), new Vector3(spacing * 0.6f, 3.4f, 0.2f));
            }
            // Doca de carga.
            _b.AddBox(MaterialSlot.Ground, new Vector3(0, 0, frontZ - 0.8f), new Vector3(size.x * 0.95f, 1.1f, 1.6f));
            _b.AddBox(MaterialSlot.Accent, new Vector3(0, size.y - 0.8f, frontZ - 0.05f), new Vector3(size.x, 0.45f, 0.12f));
            Windows(Face.Left, bodyBase, size, size.y - 2.0f, 3, 1.2f, 0.7f);
            Windows(Face.Right, bodyBase, size, size.y - 2.0f, 3, 1.2f, 0.7f);
        }

        // ------------------------------------------------------------------ Estruturas de fundo

        private void AmbientHouse(int floors, Vector2 fp)
        {
            floors = Mathf.Clamp(floors, 1, 2);
            const float floorH = 3.0f;
            var size = new Vector3(fp.x * 0.58f, floors * floorH, fp.y * 0.48f);
            var bodyBase = new Vector3(-fp.x * 0.1f, 0, fp.y * 0.05f);
            float frontZ = bodyBase.z - size.z * 0.5f;
            _b.AddBox(MaterialSlot.Wall, bodyBase, size);
            _b.AddGableRoof(MaterialSlot.Roof, MaterialSlot.Wall, bodyBase + Vector3.up * size.y, size.x, size.z, 2.2f, 0.4f);
            _b.AddBox(MaterialSlot.Accent, new Vector3(bodyBase.x - size.x * 0.2f, 0, frontZ), new Vector3(1.1f, 2.2f, 0.18f));
            _b.AddBox(MaterialSlot.Glass, new Vector3(bodyBase.x + size.x * 0.2f, 1.0f, frontZ), new Vector3(1.6f, 1.2f, 0.14f));
            if (floors > 1) Windows(Face.Front, bodyBase, size, floorH + 0.9f, 2, 1.1f, 1.2f);
            Windows(Face.Left, bodyBase, size, 1.0f, 2, 1.0f, 1.1f);
            Windows(Face.Right, bodyBase, size, 1.0f, 2, 1.0f, 1.1f);
            // Cerca viva e árvore no quintal.
            _b.AddBox(MaterialSlot.Foliage, new Vector3(0, 0, -fp.y * 0.47f), new Vector3(fp.x * 0.35f, 0.8f, 0.5f));
            Tree(new Vector3(fp.x * 0.33f, 0, fp.y * 0.25f), 1.0f);
        }

        private void AmbientApartment(int floors, Vector2 fp)
        {
            floors = Mathf.Clamp(floors, 2, 10);
            const float floorH = 3.0f;
            var size = new Vector3(fp.x * 0.78f, floors * floorH, fp.y * 0.68f);
            var bodyBase = new Vector3(0, 0, fp.y * 0.06f);
            float frontZ = bodyBase.z - size.z * 0.5f;
            _b.AddBox(MaterialSlot.Wall, bodyBase, size, topSlot: MaterialSlot.Roof);
            _b.AddFrame(MaterialSlot.Wall, bodyBase + Vector3.up * size.y, size.x, size.z, 0.25f, 0.6f);
            _b.AddBox(MaterialSlot.Trim, new Vector3(0, 0, frontZ), new Vector3(1.6f, 2.4f, 0.2f));
            WindowGrid(bodyBase, size, floors, floorH, 1, allSides: true, 1.0f, 1.4f);
            for (int f = 1; f < floors; f++)
            {
                _b.AddBox(MaterialSlot.Trim, new Vector3(-size.x * 0.25f, f * floorH, frontZ - 0.55f), new Vector3(2.2f, 0.15f, 1.1f));
                _b.AddBox(MaterialSlot.Accent, new Vector3(-size.x * 0.25f, f * floorH + 0.15f, frontZ - 1.05f), new Vector3(2.2f, 0.9f, 0.08f));
            }
            _b.AddCylinder(MaterialSlot.Metal, bodyBase + new Vector3(size.x * 0.25f, size.y, size.z * 0.2f), 0.8f, 1.6f, 8);
        }

        private void AmbientTower(int floors, Vector2 fp)
        {
            floors = Mathf.Clamp(floors, 6, 30);
            int lower = Mathf.RoundToInt(floors * 0.75f);
            OfficeBody(fp, lower, 0.8f, 0.8f, withLogo: false);
            // Recuo superior (setback) para silhueta mais interessante.
            float baseY = 4.2f + (lower - 1) * 3.4f + 0.9f;
            float w = fp.x * 0.55f, d = fp.y * 0.55f;
            float y = baseY;
            for (int f = lower; f < floors; f++)
            {
                _b.AddBox(MaterialSlot.Wall, new Vector3(0, y, 0), new Vector3(w, 1.0f, d));
                _b.AddBox(MaterialSlot.Glass, new Vector3(0, y + 1.0f, 0), new Vector3(w - 0.25f, 2.4f, d - 0.25f));
                y += 3.4f;
            }
            _b.AddBox(MaterialSlot.Wall, new Vector3(0, y, 0), new Vector3(w + 0.2f, 0.8f, d + 0.2f), topSlot: MaterialSlot.Roof);
            _b.AddCylinder(MaterialSlot.Metal, new Vector3(0, y + 0.8f, 0), 0.12f, 7f, 5);
        }

        private void ParkModel(int seed, Vector2 fp)
        {
            // Caminhos em cruz, chafariz central, bancos e árvores em posições determinísticas.
            _b.AddBox(MaterialSlot.Ground, Vector3.zero, new Vector3(fp.x, 0.06f, 2.2f));
            _b.AddBox(MaterialSlot.Ground, Vector3.zero, new Vector3(2.2f, 0.06f, fp.y));
            _b.AddCylinder(MaterialSlot.Ground, Vector3.zero, 3.0f, 0.5f, 12);
            _b.AddCylinder(MaterialSlot.Glass, Vector3.up * 0.05f, 2.6f, 0.5f, 12);
            _b.AddCylinder(MaterialSlot.Ground, Vector3.zero, 0.45f, 1.6f, 8);

            var rng = new EmpireTycoon.Simulation.Core.DeterministicRandom((ulong)(seed * 7919 + 17));
            float hx = fp.x * 0.5f - 1.5f, hz = fp.y * 0.5f - 1.5f;
            for (int q = 0; q < 4; q++)
            {
                float sx = (q & 1) == 0 ? -1 : 1, sz = (q & 2) == 0 ? -1 : 1;
                int trees = rng.Range(2, 5);
                for (int i = 0; i < trees; i++)
                {
                    float x = sx * (float)rng.Range(2.6, hx);
                    float z = sz * (float)rng.Range(2.6, hz);
                    Tree(new Vector3(x, 0, z), (float)rng.Range(0.8, 1.35));
                }
                _b.AddBox(MaterialSlot.Trim, new Vector3(sx * 4.2f, 0, sz * 1.6f), new Vector3(1.8f, 0.5f, 0.5f));
            }
        }
    }
}
