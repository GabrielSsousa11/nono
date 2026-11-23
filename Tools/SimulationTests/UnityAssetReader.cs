using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;

namespace EmpireTycoon.Tests.Tooling
{
    /// <summary>
    /// Leitor mínimo do YAML serializado pela Unity (subconjunto: mapas, listas e escalares),
    /// usado para validar os assets reais do jogo fora do Editor.
    /// </summary>
    public static class UnityAssetReader
    {
        public sealed class Node
        {
            public string Scalar;
            public readonly Dictionary<string, Node> Map = new Dictionary<string, Node>();
            public readonly List<Node> List = new List<Node>();

            public Node this[string key] => Map.TryGetValue(key, out var n) ? n : throw new KeyNotFoundException("Campo ausente: " + key);
            public string Str => Unquote(Scalar);
            public long Long => long.Parse(Scalar, CultureInfo.InvariantCulture);
            public int Int => int.Parse(Scalar, CultureInfo.InvariantCulture);
            public double Double => double.Parse(Scalar, CultureInfo.InvariantCulture);
            public ulong ULong => ulong.Parse(Scalar, CultureInfo.InvariantCulture);
        }

        public static string RepoRoot
        {
            get
            {
                var env = Environment.GetEnvironmentVariable("EMPIRE_TYCOON_ROOT");
                if (!string.IsNullOrEmpty(env)) return env;
                var dir = new DirectoryInfo(AppContext.BaseDirectory);
                while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "Assets"))) dir = dir.Parent;
                if (dir == null) throw new DirectoryNotFoundException("Raiz do projeto não encontrada.");
                return dir.FullName;
            }
        }

        /// <summary>Lê o primeiro objeto (MonoBehaviour) do arquivo.</summary>
        public static Node ReadMonoBehaviour(string path)
        {
            var lines = new List<string>();
            bool inDoc = false;
            foreach (var raw in File.ReadAllLines(path))
            {
                if (raw.StartsWith("--- ")) { if (inDoc) break; inDoc = true; continue; }
                if (!inDoc || raw.StartsWith("%") || raw.Trim().Length == 0) continue;
                lines.Add(raw);
            }
            int i = 1; // pula "MonoBehaviour:"
            return ParseBlock(lines, ref i, 2);
        }

        private static Node ParseBlock(List<string> lines, ref int i, int indent, bool listMode = false)
        {
            var node = new Node();
            while (i < lines.Count)
            {
                string line = lines[i];
                int ind = line.Length - line.TrimStart(' ').Length;
                if (ind < indent) break;
                string content = line.Trim();
                if (listMode && !content.StartsWith("- ")) break;
                if (content.StartsWith("- "))
                {
                    node.List.Add(new Node { Scalar = content.Substring(2).Trim() });
                    i++;
                    continue;
                }
                int colon = content.IndexOf(':');
                string key = content.Substring(0, colon);
                string value = content.Substring(colon + 1).Trim();
                i++;
                if (value.Length > 0)
                {
                    node.Map[key] = new Node { Scalar = value };
                }
                else if (i < lines.Count)
                {
                    int nextInd = lines[i].Length - lines[i].TrimStart(' ').Length;
                    bool isList = lines[i].Trim().StartsWith("- ");
                    if (!isList && nextInd <= ind) { node.Map[key] = new Node { Scalar = string.Empty }; continue; }
                    // Listas da Unity ficam no mesmo recuo da chave.
                    node.Map[key] = ParseBlock(lines, ref i, isList ? Math.Max(nextInd, ind) : nextInd, isList);
                }
            }
            return node;
        }

        private static string Unquote(string s)
        {
            if (s == null) return null;
            if (s.Length >= 2 && s[0] == '\'' && s[s.Length - 1] == '\'') return s.Substring(1, s.Length - 2).Replace("''", "'");
            if (s.Length >= 2 && s[0] == '"' && s[s.Length - 1] == '"') return s.Substring(1, s.Length - 2);
            return s;
        }
    }
}
