namespace ilk_projem.Models.Persistence;

public class StoredEmergencyAlert
{
    public string Id { get; set; } = "";
    public string ElderlyId { get; set; } = "";
    public string AlertType { get; set; } = "";
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = "";
    public bool IsResolved { get; set; }
    public string LocationLabel { get; set; } = "";
    public string MapsUrl { get; set; } = "";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? AccuracyMeters { get; set; }
    public bool NotificationStored { get; set; }
    public bool SmsDispatched { get; set; }
    public bool RealtimeBroadcasted { get; set; }
}
