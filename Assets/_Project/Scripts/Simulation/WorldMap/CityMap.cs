using System;
using System.Collections.Generic;
using EmpireTycoon.Simulation.Core;

namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>
    /// Representação lógica de uma cidade: grid de células (ruas/terrenos) e lista de terrenos.
    /// Preparada para múltiplas cidades (Fase 7): cada cidade tem seu próprio <see cref="CityMap"/>.
    /// </summary>
    public sealed class CityMap
    {
        public readonly int Id;
        public readonly string Name;
        public readonly int Width;
        public readonly int Height;

        private readonly CellType[] _cells;
        private readonly int[] _cellLot;
        private readonly List<Lot> _lots = new List<Lot>();

        public CityMap(int id, string name, int width, int height)
        {
            if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width));
            Id = id;
            Name = name;
            Width = width;
            Height = height;
            _cells = new CellType[width * height];
            _cellLot = new int[width * height];
            for (int i = 0; i < _cellLot.Length; i++) _cellLot[i] = -1;
        }

        public IReadOnlyList<Lot> Lots => _lots;

        public bool InBounds(GridCoord c) => c.X >= 0 && c.Y >= 0 && c.X < Width && c.Y < Height;

        public CellType GetCell(GridCoord c) => InBounds(c) ? _cells[c.Y * Width + c.X] : CellType.Empty;

        internal void SetCell(GridCoord c, CellType type) => _cells[c.Y * Width + c.X] = type;

        public Lot GetLot(int lotId) => lotId >= 0 && lotId < _lots.Count ? _lots[lotId] : null;

        public Lot GetLotAt(GridCoord c)
        {
            if (!InBounds(c)) return null;
            int id = _cellLot[c.Y * Width + c.X];
            return id >= 0 ? _lots[id] : null;
        }

        internal Lot AddLot(GridRect rect, District district, double distanceToCenter01)
        {
            for (int y = rect.Y; y < rect.MaxY; y++)
            for (int x = rect.X; x < rect.MaxX; x++)
            {
                var c = new GridCoord(x, y);
                if (!InBounds(c)) throw new ArgumentOutOfRangeException(nameof(rect), "Terreno fora do mapa: " + rect);
                if (_cellLot[y * Width + x] >= 0) throw new InvalidOperationException("Terrenos sobrepostos em " + c);
            }

            var lot = new Lot(_lots.Count, rect, district, distanceToCenter01);
            _lots.Add(lot);
            for (int y = rect.Y; y < rect.MaxY; y++)
            for (int x = rect.X; x < rect.MaxX; x++)
            {
                _cellLot[y * Width + x] = lot.Id;
                _cells[y * Width + x] = CellType.Lot;
            }
            return lot;
        }

        public int CountRoadCells()
        {
            int n = 0;
            for (int i = 0; i < _cells.Length; i++) if (_cells[i] == CellType.Road) n++;
            return n;
        }
    }
}
