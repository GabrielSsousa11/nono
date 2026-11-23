using EmpireTycoon.Simulation.Core;
using UnityEngine;

namespace EmpireTycoon.Runtime.Rendering
{
    /// <summary>Converte coordenadas do grid lógico para o espaço do mundo 3D (centro da cidade na origem).</summary>
    public sealed class CityGridMapping
    {
        public readonly float CellSize;
        public readonly int Width;
        public readonly int Height;

        public CityGridMapping(int width, int height, float cellSize)
        {
            Width = width;
            Height = height;
            CellSize = cellSize;
        }

        public Vector3 GridToWorld(float x, float y) =>
            new Vector3((x - Width * 0.5f) * CellSize, 0f, (y - Height * 0.5f) * CellSize);

        public Vector3 RectCenter(GridRect r) => GridToWorld(r.CenterX, r.CenterY);

        public Vector2 RectSize(GridRect r) => new Vector2(r.Width * CellSize, r.Height * CellSize);

        public bool WorldToCell(Vector3 world, out GridCoord cell)
        {
            int x = Mathf.FloorToInt(world.x / CellSize + Width * 0.5f);
            int y = Mathf.FloorToInt(world.z / CellSize + Height * 0.5f);
            cell = new GridCoord(x, y);
            return x >= 0 && y >= 0 && x < Width && y < Height;
        }

        public Bounds WorldBounds => new Bounds(Vector3.zero, new Vector3(Width * CellSize, 1f, Height * CellSize));
    }
}
