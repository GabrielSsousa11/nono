namespace EmpireTycoon.Simulation.WorldMap
{
    /// <summary>Indicadores agregados da cidade (base da demanda na Fase 3).</summary>
    public sealed class CityStats
    {
        public int Residents { get; private set; }
        public int Jobs { get; private set; }
        public int DevelopedLots { get; private set; }
        public int VacantLots { get; private set; }
        public int TotalLots { get; private set; }

        public void Recompute(CityMap city)
        {
            int residents = 0, jobs = 0, developed = 0, vacant = 0, total = 0;
            foreach (var lot in city.Lots)
            {
                if (lot.District == District.Park) continue;
                total++;
                if (lot.IsForSale) vacant++;
                if (lot.IsDeveloped) developed++;
                if (lot.IsAmbient && !lot.IsUnderDevelopment)
                {
                    residents += AmbientRules.Residents(lot.Ambient, lot.AmbientFloors);
                    jobs += AmbientRules.Jobs(lot.Ambient, lot.AmbientFloors);
                }
            }
            Residents = residents;
            Jobs = jobs;
            DevelopedLots = developed;
            VacantLots = vacant;
            TotalLots = total;
        }
    }
}
