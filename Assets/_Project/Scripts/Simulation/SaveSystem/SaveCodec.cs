using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.SaveSystem
{
    /// <summary>
    /// Codifica/decodifica saves. Formato:
    /// <code>"ETSV" | int32 versão | int32 tamanho | uint32 CRC32 | payload (GZip de BinaryWriter)</code>
    /// O CRC detecta corrupção (arquivo truncado, bits trocados); versões futuras são recusadas
    /// com erro claro; versões antigas passam pelas migrações registradas.
    /// </summary>
    public sealed class SaveCodec
    {
        public const int LatestFormatVersion = 1;
        private static readonly byte[] Magic = { (byte)'E', (byte)'T', (byte)'S', (byte)'V' };
        private const int HeaderSize = 16;
        private const int MaxPayloadBytes = 64 * 1024 * 1024;

        private readonly Dictionary<int, SaveMigration> _migrations = new Dictionary<int, SaveMigration>();

        public int CurrentFormatVersion { get; }

        public SaveCodec() : this(LatestFormatVersion, null) { }

        /// <summary>Construtor configurável (usado para testar a cadeia de migrações).</summary>
        public SaveCodec(int currentFormatVersion, IEnumerable<SaveMigration> migrations)
        {
            if (currentFormatVersion < 1) throw new ArgumentOutOfRangeException(nameof(currentFormatVersion));
            CurrentFormatVersion = currentFormatVersion;
            if (migrations != null)
                foreach (var m in migrations) _migrations.Add(m.FromVersion, m);
        }

        // ------------------------------------------------------------------ Escrita

        public byte[] Encode(GameSnapshot snapshot)
        {
            if (snapshot == null) throw new ArgumentNullException(nameof(snapshot));
            snapshot.FormatVersion = CurrentFormatVersion;

            byte[] payload;
            using (var compressed = new MemoryStream())
            {
                using (var gzip = new GZipStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
                using (var w = new BinaryWriter(gzip, Encoding.UTF8))
                    WritePayload(w, snapshot);
                payload = compressed.ToArray();
            }

            var result = new byte[HeaderSize + payload.Length];
            Buffer.BlockCopy(Magic, 0, result, 0, 4);
            WriteInt(result, 4, CurrentFormatVersion);
            WriteInt(result, 8, payload.Length);
            WriteInt(result, 12, unchecked((int)Crc32.Compute(payload, 0, payload.Length)));
            Buffer.BlockCopy(payload, 0, result, HeaderSize, payload.Length);
            return result;
        }

        private static void WritePayload(BinaryWriter w, GameSnapshot s)
        {
            w.Write(s.SavedAtUnixMs);
            w.Write(s.PlayerCompanyName ?? "");
            WriteCity(w, s.City);
            w.Write(s.TotalTicks);
            w.Write(s.Speed);
            w.Write(s.GrowthRngState);
            w.Write(s.NextBuildingId);

            w.Write(s.Companies.Count);
            foreach (var c in s.Companies)
            {
                w.Write(c.Id);
                w.Write(c.Name ?? "");
                w.Write(c.IsPlayer);
                w.Write(c.CashCents);
                w.Write(c.Recent.Count);
                foreach (var t in c.Recent) { w.Write(t.Tick); w.Write(t.Category); w.Write(t.AmountCents); w.Write(t.Description ?? ""); }
                w.Write(c.Days.Count);
                foreach (var d in c.Days) { w.Write(d.Day); w.Write(d.IncomeCents); w.Write(d.ExpensesCents); }
                w.Write(c.Totals.Count);
                foreach (var t in c.Totals) { w.Write(t.Category); w.Write(t.AmountCents); }
            }

            w.Write(s.Lots.Count);
            foreach (var l in s.Lots)
            {
                w.Write(l.OwnerId); w.Write(l.BuildingId); w.Write(l.Ambient); w.Write(l.AmbientFloors);
                w.Write(l.DevelopmentHoursLeft); w.Write(l.NeighborhoodBonus);
            }

            w.Write(s.Buildings.Count);
            foreach (var b in s.Buildings)
            {
                w.Write(b.Id); w.Write(b.DefinitionId ?? ""); w.Write(b.LotId); w.Write(b.OwnerId); w.Write(b.Level);
                w.Write(b.State); w.Write(b.WorkDoneHours); w.Write(b.WorkTotalHours); w.Write(b.InvestedCents);
            }
        }

        private static void WriteCity(BinaryWriter w, CityLayoutConfig c)
        {
            w.Write(c.CityName ?? "");
            w.Write(c.Seed);
            w.Write(c.BlocksX); w.Write(c.BlocksY); w.Write(c.BlockSize);
            w.Write(c.AmbientDensity.Length);
            foreach (var d in c.AmbientDensity) w.Write(d);
            w.Write(c.ParkChance);
        }

        // ------------------------------------------------------------------ Leitura

        public GameSnapshot Decode(byte[] data)
        {
            if (data == null || data.Length < HeaderSize) throw new SaveException(SaveError.Corrupted, "Arquivo de save vazio ou truncado.");
            for (int i = 0; i < 4; i++)
                if (data[i] != Magic[i]) throw new SaveException(SaveError.Corrupted, "Arquivo não é um save do Empire Tycoon.");

            int version = ReadInt(data, 4);
            int length = ReadInt(data, 8);
            uint crc = unchecked((uint)ReadInt(data, 12));

            if (version > CurrentFormatVersion)
                throw new SaveException(SaveError.NewerVersion, "Save criado por uma versão mais nova do jogo (formato " + version + "). Atualize o jogo.");
            if (version < 1) throw new SaveException(SaveError.UnsupportedVersion, "Formato de save desconhecido: " + version);
            if (length < 0 || length > MaxPayloadBytes || HeaderSize + length != data.Length)
                throw new SaveException(SaveError.Corrupted, "Tamanho do save inconsistente (arquivo truncado?).");
            if (Crc32.Compute(data, HeaderSize, length) != crc)
                throw new SaveException(SaveError.Corrupted, "Checksum inválido: save corrompido.");

            GameSnapshot snapshot;
            try
            {
                using (var ms = new MemoryStream(data, HeaderSize, length, writable: false))
                using (var gzip = new GZipStream(ms, CompressionMode.Decompress))
                using (var r = new BinaryReader(gzip, Encoding.UTF8))
                    snapshot = ReadPayload(r, version);
            }
            catch (SaveException) { throw; }
            catch (Exception e) when (e is IOException || e is InvalidDataException || e is ArgumentException || e is EndOfStreamException || e is OverflowException)
            {
                throw new SaveException(SaveError.Corrupted, "Conteúdo do save ilegível: " + e.Message, e);
            }

            snapshot.FormatVersion = version;
            Migrate(snapshot);
            return snapshot;
        }

        private void Migrate(GameSnapshot snapshot)
        {
            while (snapshot.FormatVersion < CurrentFormatVersion)
            {
                if (!_migrations.TryGetValue(snapshot.FormatVersion, out var migration))
                    throw new SaveException(SaveError.UnsupportedVersion, "Sem migração do formato " + snapshot.FormatVersion + " para " + (snapshot.FormatVersion + 1) + ".");
                migration.Apply(snapshot);
                snapshot.FormatVersion++;
            }
        }

        private static GameSnapshot ReadPayload(BinaryReader r, int version)
        {
            var s = new GameSnapshot
            {
                SavedAtUnixMs = r.ReadInt64(),
                PlayerCompanyName = r.ReadString(),
                City = ReadCity(r),
                TotalTicks = r.ReadInt64(),
                Speed = r.ReadInt32(),
                GrowthRngState = r.ReadUInt64(),
                NextBuildingId = r.ReadInt32(),
            };

            int companies = ReadCount(r);
            for (int i = 0; i < companies; i++)
            {
                var c = new CompanySave { Id = r.ReadInt32(), Name = r.ReadString(), IsPlayer = r.ReadBoolean(), CashCents = r.ReadInt64() };
                int recent = ReadCount(r);
                for (int k = 0; k < recent; k++)
                    c.Recent.Add(new TransactionSave { Tick = r.ReadInt64(), Category = r.ReadInt32(), AmountCents = r.ReadInt64(), Description = r.ReadString() });
                int days = ReadCount(r);
                for (int k = 0; k < days; k++)
                    c.Days.Add(new DailyReportSave { Day = r.ReadInt64(), IncomeCents = r.ReadInt64(), ExpensesCents = r.ReadInt64() });
                int totals = ReadCount(r);
                for (int k = 0; k < totals; k++)
                    c.Totals.Add(new CategoryTotalSave { Category = r.ReadInt32(), AmountCents = r.ReadInt64() });
                s.Companies.Add(c);
            }

            int lots = ReadCount(r);
            for (int i = 0; i < lots; i++)
                s.Lots.Add(new LotSave
                {
                    OwnerId = r.ReadInt32(), BuildingId = r.ReadInt32(), Ambient = r.ReadInt32(), AmbientFloors = r.ReadInt32(),
                    DevelopmentHoursLeft = r.ReadInt32(), NeighborhoodBonus = r.ReadDouble(),
                });

            int buildings = ReadCount(r);
            for (int i = 0; i < buildings; i++)
                s.Buildings.Add(new BuildingSave
                {
                    Id = r.ReadInt32(), DefinitionId = r.ReadString(), LotId = r.ReadInt32(), OwnerId = r.ReadInt32(), Level = r.ReadInt32(),
                    State = r.ReadInt32(), WorkDoneHours = r.ReadInt32(), WorkTotalHours = r.ReadInt32(), InvestedCents = r.ReadInt64(),
                });

            // Campos de versões futuras: "if (version >= 2) s.NovoCampo = r.Read...();"
            return s;
        }

        private static CityLayoutConfig ReadCity(BinaryReader r)
        {
            var c = new CityLayoutConfig
            {
                CityName = r.ReadString(),
                Seed = r.ReadUInt64(),
                BlocksX = r.ReadInt32(),
                BlocksY = r.ReadInt32(),
                BlockSize = r.ReadInt32(),
            };
            int n = ReadCount(r, 64);
            c.AmbientDensity = new double[n];
            for (int i = 0; i < n; i++) c.AmbientDensity[i] = r.ReadDouble();
            c.ParkChance = r.ReadDouble();
            return c;
        }

        private static int ReadCount(BinaryReader r, int max = 1_000_000)
        {
            int n = r.ReadInt32();
            if (n < 0 || n > max) throw new SaveException(SaveError.Corrupted, "Contagem inválida no save: " + n);
            return n;
        }

        private static void WriteInt(byte[] b, int offset, int v)
        {
            b[offset] = (byte)v; b[offset + 1] = (byte)(v >> 8); b[offset + 2] = (byte)(v >> 16); b[offset + 3] = (byte)(v >> 24);
        }

        private static int ReadInt(byte[] b, int offset) => b[offset] | (b[offset + 1] << 8) | (b[offset + 2] << 16) | (b[offset + 3] << 24);
    }
}
