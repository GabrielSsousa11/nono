using System;

namespace EmpireTycoon.Simulation.WorldMap
{
    [Serializable]
    public sealed class CityLayoutConfig
    {
        public string CityName = "Nova Aurora";
        public ulong Seed = 20261123;

        /// <summary>Número de quarteirões em cada eixo.</summary>
        public int BlocksX = 7;
        public int BlocksY = 7;

        /// <summary>Tamanho do quarteirão em células (sem contar ruas). Deve ser par.</summary>
        public int BlockSize = 6;

        /// <summary>Probabilidade de um terreno ser ocupado por estrutura de fundo, por distrito.</summary>
        public double[] AmbientDensity = { 0.7, 0.45, 0.35, 0.55, 0 };

        /// <summary>Probabilidade de um quarteirão não central virar praça.</summary>
        public double ParkChance = 0.08;

        public int Width => BlocksX * (BlockSize + 1) + 1;
        public int Height => BlocksY * (BlockSize + 1) + 1;

        public void Validate()
        {
            if (BlocksX < 3 || BlocksY < 3) throw new InvalidOperationException("A cidade precisa de pelo menos 3x3 quarteirões.");
            if (BlocksX > 64 || BlocksY > 64) throw new InvalidOperationException("Cidade grande demais para um único mapa.");
            if (BlockSize < 4 || BlockSize % 2 != 0) throw new InvalidOperationException("BlockSize deve ser par e >= 4.");
            int districts = Enum.GetValues(typeof(District)).Length;
            if (AmbientDensity == null || AmbientDensity.Length != districts)
                throw new InvalidOperationException("AmbientDensity deve ter " + districts + " valores.");
            foreach (var d in AmbientDensity)
                if (d < 0 || d > 1) throw new InvalidOperationException("AmbientDensity deve estar em [0, 1].");
            if (ParkChance < 0 || ParkChance > 1) throw new InvalidOperationException("ParkChance deve estar em [0, 1].");
        }
    }
}
