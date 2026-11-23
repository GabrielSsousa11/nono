using System;

namespace EmpireTycoon.Simulation.SaveSystem
{
    public enum SaveError
    {
        None = 0,
        NotFound,
        Corrupted,
        NewerVersion,
        UnsupportedVersion,
        IncompatibleData,
        IOFailure,
    }

    public sealed class SaveException : Exception
    {
        public readonly SaveError Error;

        public SaveException(SaveError error, string message, Exception inner = null) : base(message, inner)
        {
            Error = error;
        }
    }

    /// <summary>Etapa de migração de um formato antigo para o seguinte (FromVersion → FromVersion + 1).</summary>
    public sealed class SaveMigration
    {
        public readonly int FromVersion;
        public readonly Action<GameSnapshot> Apply;

        public SaveMigration(int fromVersion, Action<GameSnapshot> apply)
        {
            FromVersion = fromVersion;
            Apply = apply ?? throw new ArgumentNullException(nameof(apply));
        }
    }
}
