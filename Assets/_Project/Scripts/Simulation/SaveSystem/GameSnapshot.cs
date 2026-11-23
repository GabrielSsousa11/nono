using System.Collections.Generic;
using EmpireTycoon.Simulation.WorldMap;

namespace EmpireTycoon.Simulation.SaveSystem
{
    /// <summary>
    /// Estado completo e serializável de uma partida (DTO). Contém apenas dados — nenhuma regra.
    /// Ao adicionar campos: incremente <see cref="SaveCodec.CurrentFormatVersion"/>, leia o campo apenas
    /// quando <c>version &gt;= N</c> e, se necessário, registre uma <see cref="SaveMigration"/>.
    /// </summary>
    public sealed class GameSnapshot
    {
        public int FormatVersion;
        public long SavedAtUnixMs;
        public string PlayerCompanyName = "";
        public CityLayoutConfig City = new CityLayoutConfig();
        public long TotalTicks;
        public int Speed;
        public ulong GrowthRngState;
        public int NextBuildingId;
        public List<CompanySave> Companies = new List<CompanySave>();
        public List<LotSave> Lots = new List<LotSave>();
        public List<BuildingSave> Buildings = new List<BuildingSave>();

        public CompanySave PlayerCompany
        {
            get
            {
                foreach (var c in Companies) if (c.IsPlayer) return c;
                return null;
            }
        }
    }

    public sealed class CompanySave
    {
        public int Id;
        public string Name = "";
        public bool IsPlayer;
        public long CashCents;
        public List<TransactionSave> Recent = new List<TransactionSave>();
        public List<DailyReportSave> Days = new List<DailyReportSave>();
        public List<CategoryTotalSave> Totals = new List<CategoryTotalSave>();
    }

    public struct TransactionSave
    {
        public long Tick;
        public int Category;
        public long AmountCents;
        public string Description;
    }

    public struct DailyReportSave
    {
        public long Day;
        public long IncomeCents;
        public long ExpensesCents;
    }

    public struct CategoryTotalSave
    {
        public int Category;
        public long AmountCents;
    }

    /// <summary>Estado variável de um terreno; o índice na lista é o Id do terreno (a geometria vem da semente).</summary>
    public struct LotSave
    {
        public int OwnerId;
        public int BuildingId;
        public int Ambient;
        public int AmbientFloors;
        public int DevelopmentHoursLeft;
        public double NeighborhoodBonus;
    }

    public struct BuildingSave
    {
        public int Id;
        public string DefinitionId;
        public int LotId;
        public int OwnerId;
        public int Level;
        public int State;
        public int WorkDoneHours;
        public int WorkTotalHours;
        public long InvestedCents;
    }

    /// <summary>Resumo para listar saves sem carregar a partida.</summary>
    public sealed class SaveSummary
    {
        public string Slot;
        public string CompanyName;
        public string CityName;
        public long CashCents;
        public long TotalTicks;
        public long SavedAtUnixMs;
        public bool FromBackup;

        public static SaveSummary From(string slot, GameSnapshot s, bool fromBackup)
        {
            var player = s.PlayerCompany;
            return new SaveSummary
            {
                Slot = slot,
                CompanyName = player != null ? player.Name : s.PlayerCompanyName,
                CityName = s.City != null ? s.City.CityName : "",
                CashCents = player != null ? player.CashCents : 0,
                TotalTicks = s.TotalTicks,
                SavedAtUnixMs = s.SavedAtUnixMs,
                FromBackup = fromBackup,
            };
        }
    }
}
