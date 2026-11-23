using System;
using System.Collections.Generic;
using System.IO;

namespace EmpireTycoon.Simulation.SaveSystem
{
    /// <summary>Resultado de um carregamento, incluindo de qual arquivo veio e problemas encontrados.</summary>
    public sealed class SaveLoadResult
    {
        public GameSnapshot Snapshot;
        public string SourcePath;
        public bool FromBackup;
        public SaveError Error;
        public string ErrorMessage;
        public readonly List<string> Problems = new List<string>();

        public bool Success => Snapshot != null;
    }

    /// <summary>
    /// Armazenamento local de saves em arquivos, com proteção contra corrupção:
    /// <list type="bullet">
    /// <item>escrita atômica: grava em ".tmp", valida decodificando, e só então substitui;</item>
    /// <item>backups rotativos (".bak1", ".bak2"...) do save anterior;</item>
    /// <item>recuperação: se o save principal estiver corrompido, tenta os backups em ordem.</item>
    /// </list>
    /// C# puro (System.IO): na Unity o diretório é <c>Application.persistentDataPath/saves</c>.
    /// </summary>
    public sealed class SaveStorage
    {
        public const string Extension = ".etsave";

        private readonly string _directory;
        private readonly SaveCodec _codec;
        private readonly int _backupCount;

        public SaveStorage(string directory, SaveCodec codec = null, int backupCount = 2)
        {
            if (string.IsNullOrEmpty(directory)) throw new ArgumentException("Diretório de saves inválido.", nameof(directory));
            if (backupCount < 0 || backupCount > 9) throw new ArgumentOutOfRangeException(nameof(backupCount));
            _directory = directory;
            _codec = codec ?? new SaveCodec();
            _backupCount = backupCount;
        }

        public string Directory => _directory;

        public string PathFor(string slot) => Path.Combine(_directory, ValidateSlot(slot) + Extension);
        public string BackupPathFor(string slot, int index) => PathFor(slot) + ".bak" + index;

        public bool Exists(string slot)
        {
            if (File.Exists(PathFor(slot))) return true;
            for (int i = 1; i <= _backupCount; i++) if (File.Exists(BackupPathFor(slot, i))) return true;
            return false;
        }

        /// <summary>Grava o snapshot no slot. Lança <see cref="SaveException"/> (IOFailure) se o disco falhar.</summary>
        public void Save(string slot, GameSnapshot snapshot)
        {
            string path = PathFor(slot);
            string tmp = path + ".tmp";
            try
            {
                System.IO.Directory.CreateDirectory(_directory);
                byte[] bytes = _codec.Encode(snapshot);
                _codec.Decode(bytes); // valida antes de tocar no disco

                using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    fs.Write(bytes, 0, bytes.Length);
                    fs.Flush(true);
                }

                // Rotação: bakN-1 → bakN ... atual → bak1, depois tmp → atual.
                if (_backupCount > 0 && File.Exists(path))
                {
                    string oldest = BackupPathFor(slot, _backupCount);
                    if (File.Exists(oldest)) File.Delete(oldest);
                    for (int i = _backupCount - 1; i >= 1; i--)
                    {
                        string from = BackupPathFor(slot, i);
                        if (File.Exists(from)) File.Move(from, BackupPathFor(slot, i + 1));
                    }
                    File.Move(path, BackupPathFor(slot, 1));
                }
                else if (File.Exists(path))
                {
                    File.Delete(path);
                }
                File.Move(tmp, path);
            }
            catch (SaveException) { throw; }
            catch (Exception e) when (e is IOException || e is UnauthorizedAccessException)
            {
                TryDelete(tmp);
                throw new SaveException(SaveError.IOFailure, "Falha ao gravar o save: " + e.Message, e);
            }
        }

        /// <summary>Carrega o slot; em caso de corrupção, recorre aos backups.</summary>
        public SaveLoadResult Load(string slot)
        {
            var result = new SaveLoadResult { Error = SaveError.NotFound, ErrorMessage = "Nenhum save encontrado." };
            var candidates = new List<string> { PathFor(slot) };
            for (int i = 1; i <= _backupCount; i++) candidates.Add(BackupPathFor(slot, i));

            for (int i = 0; i < candidates.Count; i++)
            {
                string file = candidates[i];
                if (!File.Exists(file)) continue;
                try
                {
                    var snapshot = _codec.Decode(File.ReadAllBytes(file));
                    result.Snapshot = snapshot;
                    result.SourcePath = file;
                    result.FromBackup = i > 0;
                    result.Error = SaveError.None;
                    result.ErrorMessage = null;
                    if (i > 0) result.Problems.Add("Save principal ilegível; recuperado do backup " + i + ".");
                    return result;
                }
                catch (SaveException e)
                {
                    result.Problems.Add(Path.GetFileName(file) + ": " + e.Message);
                    // Um save de versão mais nova não é "corrompido": não mascare isso com um backup antigo.
                    if (e.Error == SaveError.NewerVersion) { result.Error = e.Error; result.ErrorMessage = e.Message; return result; }
                    result.Error = e.Error;
                    result.ErrorMessage = e.Message;
                }
                catch (Exception e) when (e is IOException || e is UnauthorizedAccessException)
                {
                    result.Problems.Add(Path.GetFileName(file) + ": " + e.Message);
                    result.Error = SaveError.IOFailure;
                    result.ErrorMessage = e.Message;
                }
            }
            return result;
        }

        public SaveSummary PeekSummary(string slot)
        {
            var r = Load(slot);
            return r.Success ? SaveSummary.From(slot, r.Snapshot, r.FromBackup) : null;
        }

        public void Delete(string slot)
        {
            TryDelete(PathFor(slot));
            TryDelete(PathFor(slot) + ".tmp");
            for (int i = 1; i <= _backupCount; i++) TryDelete(BackupPathFor(slot, i));
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        private static string ValidateSlot(string slot)
        {
            if (string.IsNullOrEmpty(slot) || slot.Length > 32) throw new ArgumentException("Nome de slot inválido.", nameof(slot));
            foreach (char ch in slot)
                if (!(ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' || ch == '_' || ch == '-'))
                    throw new ArgumentException("Nome de slot inválido: " + slot, nameof(slot));
            return slot;
        }
    }
}
