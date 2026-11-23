using System;

namespace EmpireTycoon.Simulation.Core
{
    /// <summary>Coordenada inteira de célula no grid da cidade (X = leste, Y = norte).</summary>
    [Serializable]
    public readonly struct GridCoord : IEquatable<GridCoord>
    {
        public readonly int X;
        public readonly int Y;

        public GridCoord(int x, int y) { X = x; Y = y; }

        public bool Equals(GridCoord other) => X == other.X && Y == other.Y;
        public override bool Equals(object obj) => obj is GridCoord c && Equals(c);
        public override int GetHashCode() => unchecked((X * 73856093) ^ (Y * 19349663));
        public static bool operator ==(GridCoord a, GridCoord b) => a.Equals(b);
        public static bool operator !=(GridCoord a, GridCoord b) => !a.Equals(b);
        public override string ToString() => "(" + X + ", " + Y + ")";
    }

    /// <summary>Retângulo de células [X, X+Width) x [Y, Y+Height).</summary>
    [Serializable]
    public readonly struct GridRect : IEquatable<GridRect>
    {
        public readonly int X;
        public readonly int Y;
        public readonly int Width;
        public readonly int Height;

        public GridRect(int x, int y, int width, int height)
        {
            if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width), "Dimensões devem ser positivas.");
            X = x; Y = y; Width = width; Height = height;
        }

        public int Area => Width * Height;
        public int MaxX => X + Width;
        public int MaxY => Y + Height;
        public float CenterX => X + Width * 0.5f;
        public float CenterY => Y + Height * 0.5f;

        public bool Contains(GridCoord c) => c.X >= X && c.X < MaxX && c.Y >= Y && c.Y < MaxY;

        public bool Overlaps(GridRect o) => X < o.MaxX && o.X < MaxX && Y < o.MaxY && o.Y < MaxY;

        public bool Equals(GridRect o) => X == o.X && Y == o.Y && Width == o.Width && Height == o.Height;
        public override bool Equals(object obj) => obj is GridRect r && Equals(r);
        public override int GetHashCode() => unchecked(((X * 397 ^ Y) * 397 ^ Width) * 397 ^ Height);
        public override string ToString() => "[" + X + "," + Y + " " + Width + "x" + Height + "]";
    }
}
