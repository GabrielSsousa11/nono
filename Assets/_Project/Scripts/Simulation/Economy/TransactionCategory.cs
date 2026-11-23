namespace EmpireTycoon.Simulation.Economy
{
    public enum TransactionCategory
    {
        InitialCapital = 0,
        LandPurchase,
        LandSale,
        TransferTax,
        Construction,
        Upgrade,
        DemolitionRefund,
        Maintenance,
        PropertyTax,
        /// <summary>Ajustes de compatibilidade (ex.: tipo de edifício removido do jogo, investimento devolvido).</summary>
        Compensation,
    }
}
