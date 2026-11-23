namespace EmpireTycoon.Simulation.Core
{
    /// <summary>Motivos pelos quais um comando de jogo pode ser recusado.</summary>
    public enum CommandError
    {
        None = 0,
        UnknownCompany,
        UnknownLot,
        UnknownBuilding,
        UnknownDefinition,
        InsufficientFunds,
        LotNotForSale,
        LotAlreadyOwned,
        LotNotOwned,
        LotOccupied,
        LotHasBuilding,
        LotTooSmall,
        DistrictNotAllowed,
        BuildingBusy,
        MaxLevelReached,
        NotBuildingOwner,
    }

    /// <summary>Resultado de um comando: sucesso ou erro, junto com o custo/valor envolvido.</summary>
    public readonly struct CommandResult
    {
        public readonly CommandError Error;
        public readonly Money Amount;
        public readonly int EntityId;

        private CommandResult(CommandError error, Money amount, int entityId)
        {
            Error = error;
            Amount = amount;
            EntityId = entityId;
        }

        public bool Success => Error == CommandError.None;

        public static CommandResult Ok(Money amount, int entityId = -1) => new CommandResult(CommandError.None, amount, entityId);
        public static CommandResult Fail(CommandError error, Money amount = default) => new CommandResult(error, amount, -1);

        public override string ToString() => Success ? "Ok(" + Amount + ")" : "Fail(" + Error + ")";
    }
}
