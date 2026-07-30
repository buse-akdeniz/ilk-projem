using System.Security.Claims;
using System.Text.Json;
using ilk_projem.Data;
using ilk_projem.Hubs;
using ilk_projem.Models.Persistence;
using ilk_projem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace ilk_projem.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class CompatibilityController : ControllerBase
{
    private readonly AppDbContext _db;

    public CompatibilityController(AppDbContext db)
    {
        _db = db;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public IResult Health() => Results.Ok(new { success = true, ok = true, serverTime = DateTime.UtcNow });

    [HttpGet("family/subscription")]
    public async Task<IResult> FamilySubscription(
        [FromServices] SubscriptionService subscriptions,
        CancellationToken cancellationToken)
    {
        var entitlement = await subscriptions.GetEntitlementAsync(ElderlyId(), cancellationToken);
        return Results.Ok(new
        {
            success = true,
            plan = entitlement.Plan,
            isActive = entitlement.IsActive,
            entitlement.HasFullAccess,
            entitlement.ExpiresAt,
            entitlement.AdUnlockUntil
        });
    }

    [HttpGet("family/account")]
    public async Task<IResult> FamilyAccount(
        [FromServices] UserManager<ApplicationUser> users)
    {
        var user = await users.FindByIdAsync(UserId());
        return user is null
            ? Results.Unauthorized()
            : Results.Ok(new
            {
                success = true,
                account = new
                {
                    name = user.DisplayName,
                    user.Email,
                    phone = user.PhoneNumber,
                    updatedAt = user.LastAuthenticatedAt
                }
            });
    }

    [HttpPut("family/account")]
    public async Task<IResult> UpdateFamilyAccount(
        [FromBody] FamilyAccountRequest request,
        [FromServices] UserManager<ApplicationUser> users)
    {
        var user = await users.FindByIdAsync(UserId());
        if (user is null) return Results.Unauthorized();
        user.DisplayName = request.Name.Trim();
        user.PhoneNumber = request.Phone?.Trim();
        if (!string.IsNullOrWhiteSpace(request.Email) && !string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailResult = await users.SetEmailAsync(user, request.Email.Trim());
            if (!emailResult.Succeeded)
                return Results.BadRequest(new { success = false, message = emailResult.Errors.First().Description });
            await users.SetUserNameAsync(user, request.Email.Trim());
        }
        await users.UpdateAsync(user);
        return Results.Ok(new { success = true, message = "Hesap bilgileri güncellendi" });
    }

    [HttpGet("family/last-contact")]
    public async Task<IResult> FamilyLastContact(CancellationToken cancellationToken)
    {
        var contact = await _db.FamilyContacts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ElderlyId == ElderlyId(), cancellationToken);
        var hours = contact is null ? (double?)null : (DateTime.UtcNow - contact.LastContactAt).TotalHours;
        return Results.Ok(new { success = true, hoursSince = hours });
    }

    [HttpPost("family/contact")]
    public async Task<IResult> MarkFamilyContact(CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        var contact = await _db.FamilyContacts
            .SingleOrDefaultAsync(x => x.ElderlyId == elderlyId, cancellationToken);
        if (contact is null)
        {
            contact = new StoredFamilyContact { ElderlyId = elderlyId };
            _db.FamilyContacts.Add(contact);
        }
        contact.LastContactAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, contactAt = contact.LastContactAt });
    }

    [Authorize(Roles = "Family")]
    [HttpGet("family/dashboard/{elderlyId}")]
    public async Task<IResult> FamilyDashboard(
        string elderlyId,
        [FromServices] SubscriptionService subscriptions,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(elderlyId, ElderlyId(), StringComparison.Ordinal))
            return Results.Forbid();
        if (!await subscriptions.HasPremiumAccessAsync(elderlyId, cancellationToken))
            return Results.Json(new { success = false, message = "Premium abonelik gerekli" }, statusCode: 402);

        var elderly = await _db.Users.AsNoTracking()
            .SingleOrDefaultAsync(u => u.Id == elderlyId && u.AccountType == "Elderly", cancellationToken);
        if (elderly is null) return Results.NotFound();

        var medications = await _db.Medications.AsNoTracking()
            .Where(m => m.ElderlyId == elderlyId)
            .OrderBy(m => m.Name)
            .ToListAsync(cancellationToken);
        var notifications = await _db.Notifications.AsNoTracking()
            .Where(n => n.ElderlyId == elderlyId)
            .OrderByDescending(n => n.Timestamp)
            .Take(8)
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            elderly = new { elderly.Id, name = elderly.DisplayName, phone = elderly.PhoneNumber },
            todayMedications = medications.Select(m => new
            {
                medicationName = m.Name,
                scheduleTimes = DeserializeTimes(m.ScheduleTimesJson),
                m.Notes,
                takenToday = m.LastTakenAt is null ? [] : new[] { m.LastTakenAt.Value }
            }),
            recentNotifications = notifications.Select(n => new
            {
                n.Type,
                title = n.Severity == "critical" ? "Acil Durum" : "Bildirim",
                n.Message,
                createdAt = n.Timestamp
            })
        });
    }

    [HttpGet("mood-analysis")]
    public async Task<IResult> MoodAnalysis(
        [FromServices] SubscriptionService subscriptions,
        CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        if (!await subscriptions.HasPremiumAccessAsync(elderlyId, cancellationToken))
            return Results.Json(new { success = false, message = "Premium abonelik gerekli" }, statusCode: 402);
        var recent = await _db.MoodRecords.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId)
            .OrderByDescending(x => x.Timestamp)
            .Take(5)
            .ToListAsync(cancellationToken);
        return Results.Ok(new
        {
            success = true,
            averageMood = recent.Count == 0 ? 0 : Math.Round(recent.Average(x => x.MoodScore), 1),
            trend = "stable",
            recentMoods = recent
        });
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("mood")]
    public async Task<IResult> AddMood([FromBody] MoodRequest request, CancellationToken cancellationToken)
    {
        if (request.MoodScore is < 1 or > 10)
            return Results.BadRequest(new { success = false, message = "Mood score must be between 1 and 10." });
        _db.MoodRecords.Add(new StoredMoodRecord
        {
            ElderlyId = ElderlyId(),
            MoodScore = request.MoodScore,
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true });
    }

    [HttpGet("health-records")]
    public async Task<IResult> HealthRecords(CancellationToken cancellationToken)
    {
        var records = await _db.HealthRecords.AsNoTracking()
            .Where(x => x.ElderlyId == ElderlyId())
            .OrderByDescending(x => x.RecordedAt)
            .Take(200)
            .Select(x => new
            {
                x.Id,
                recordType = x.MetricType,
                x.Value,
                unit = x.Notes,
                alertLevel = x.HealthStatus,
                timestamp = x.RecordedAt
            })
            .ToListAsync(cancellationToken);
        return Results.Ok(records);
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("health-records")]
    public async Task<IResult> AddHealthRecord(
        [FromBody] HealthRecordRequest request,
        CancellationToken cancellationToken)
    {
        var alert = request.Value > 180 ? "critical" : request.Value > 140 ? "warning" : "normal";
        _db.HealthRecords.Add(new StoredHealthRecord
        {
            ElderlyId = ElderlyId(),
            MetricType = request.RecordType,
            Value = request.Value,
            Notes = request.Unit,
            HealthStatus = alert,
            RecordedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, alertLevel = alert, healthStatus = alert });
    }

    [HttpGet("medications")]
    public async Task<IResult> Medications(CancellationToken cancellationToken)
    {
        var items = await _db.Medications.AsNoTracking()
            .Where(x => x.ElderlyId == ElderlyId())
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);
        return Results.Ok(items.Select(ToMedicationResponse));
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("medications")]
    public async Task<IResult> AddMedication(
        [FromBody] MedicationRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { success = false, message = "İlaç adı zorunludur." });
        _db.Medications.Add(new StoredMedication
        {
            ElderlyId = ElderlyId(),
            Name = request.Name.Trim(),
            Notes = request.Notes?.Trim() ?? "",
            ScheduleTimesJson = JsonSerializer.Serialize(request.ScheduleTimes ?? []),
            StockCount = 30
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true });
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("medications/{id:int}/taken")]
    public async Task<IResult> TakeMedication(int id, CancellationToken cancellationToken)
    {
        var medication = await _db.Medications
            .SingleOrDefaultAsync(x => x.Id == id && x.ElderlyId == ElderlyId(), cancellationToken);
        if (medication is null) return Results.NotFound(new { success = false, message = "İlaç bulunamadı" });
        medication.LastTakenAt = DateTime.UtcNow;
        medication.StockCount = Math.Max(0, (medication.StockCount ?? 0) - 1);
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            success = true,
            medication = ToMedicationResponse(medication),
            stockCount = medication.StockCount
        });
    }

    [Authorize(Roles = "Elderly")]
    [HttpDelete("medications/{id:int}")]
    public async Task<IResult> DeleteMedication(int id, CancellationToken cancellationToken)
    {
        var medication = await _db.Medications
            .SingleOrDefaultAsync(x => x.Id == id && x.ElderlyId == ElderlyId(), cancellationToken);
        if (medication is null)
            return Results.NotFound(new { success = false, message = "İlaç bulunamadı" });
        _db.Medications.Remove(medication);
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, deleted = true, id });
    }

    [HttpGet("family-members")]
    public async Task<IResult> FamilyMembers(
        [FromServices] SubscriptionService subscriptions,
        CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        if (!await subscriptions.HasPremiumAccessAsync(elderlyId, cancellationToken))
            return Results.Json(new { success = false, message = "Premium abonelik gerekli" }, statusCode: 402);
        var members = await _db.FamilyMembers.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId)
            .ToListAsync(cancellationToken);
        return Results.Ok(new { success = true, members });
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("family-members")]
    public async Task<IResult> AddFamilyMember(
        [FromBody] FamilyMemberRequest request,
        [FromServices] SubscriptionService subscriptions,
        CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        if (!await subscriptions.HasPremiumAccessAsync(elderlyId, cancellationToken))
            return Results.Json(new { success = false, message = "Premium abonelik gerekli" }, statusCode: 402);
        if (await _db.FamilyMembers.AnyAsync(x => x.ElderlyId == elderlyId && x.Email == request.Email, cancellationToken))
            return Results.Conflict(new { success = false, message = "Bu aile üyesi zaten kayıtlı." });
        _db.FamilyMembers.Add(new StoredFamilyMember
        {
            Id = Guid.NewGuid().ToString("N"),
            ElderlyId = elderlyId,
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Relationship = request.Relationship?.Trim() ?? "",
            PhoneNumber = request.PhoneNumber?.Trim() ?? ""
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true });
    }

    [HttpGet("notifications")]
    public async Task<IResult> Notifications(CancellationToken cancellationToken)
    {
        var items = await _db.Notifications.AsNoTracking()
            .Where(x => x.ElderlyId == ElderlyId())
            .OrderByDescending(x => x.Timestamp)
            .Take(100)
            .ToListAsync(cancellationToken);
        return Results.Ok(items);
    }

    [HttpGet("doctor/report")]
    public async Task<IResult> DoctorReport(CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        var elderly = await _db.Users.AsNoTracking()
            .Where(x => x.Id == elderlyId)
            .Select(x => new
            {
                x.DisplayName,
                x.Email,
                x.PhoneNumber,
                x.BirthDate,
                x.BloodType,
                x.Allergies,
                x.MedicalHistory
            })
            .SingleAsync(cancellationToken);
        var healthRecords = await _db.HealthRecords.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId)
            .OrderByDescending(x => x.RecordedAt)
            .Take(100)
            .ToListAsync(cancellationToken);
        var medications = await _db.Medications.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var moods = await _db.MoodRecords.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId)
            .OrderByDescending(x => x.Timestamp)
            .Take(30)
            .ToListAsync(cancellationToken);
        return Results.Ok(new
        {
            success = true,
            generatedAt = DateTime.UtcNow,
            elderly = new
            {
                name = elderly.DisplayName,
                elderly.Email,
                phone = elderly.PhoneNumber,
                elderly.BirthDate,
                elderly.BloodType,
                elderly.Allergies,
                elderly.MedicalHistory
            },
            healthRecords = healthRecords.Select(x => new
            {
                timestamp = x.RecordedAt,
                recordType = x.MetricType,
                x.Value,
                x.Systolic,
                x.Diastolic,
                x.Glucose,
                x.HeartRate,
                status = x.HealthStatus,
                x.Notes
            }),
            medications = medications.Select(ToMedicationResponse),
            mood = new
            {
                average = moods.Count == 0 ? (double?)null : Math.Round(moods.Average(x => x.MoodScore), 1),
                trend = "stable"
            }
        });
    }

    [HttpPost("send-notification")]
    public async Task<IResult> SendNotification(
        [FromBody] NotificationRequest request,
        CancellationToken cancellationToken)
    {
        _db.Notifications.Add(new StoredNotification
        {
            ElderlyId = ElderlyId(),
            Type = request.Type ?? "info",
            Message = request.Message,
            Severity = request.Severity ?? "normal"
        });
        await _db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, notificationStored = true });
    }

    [Authorize(Roles = "Elderly")]
    [HttpPost("emergency-alert")]
    [HttpPost("emergency-broadcast")]
    public async Task<IResult> EmergencyAlert(
        [FromBody] JsonElement payload,
        [FromServices] IHubContext<HealthReportHub> hub,
        [FromServices] PushNotificationService push,
        [FromServices] EmergencySmsService sms,
        [FromServices] IDataProtectionProvider dataProtection,
        [FromServices] IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        var elderly = await _db.Users.AsNoTracking()
            .Where(x => x.Id == elderlyId)
            .Select(x => new { x.DisplayName, x.PhoneNumber })
            .SingleOrDefaultAsync(cancellationToken);
        var elderlyName = string.IsNullOrWhiteSpace(elderly?.DisplayName) ? "SafeGuardian kullanıcısı" : elderly.DisplayName;

        var (locationLabel, mapsUrl, latitude, longitude, accuracy) = ParseEmergencyLocation(payload);
        var description = payload.TryGetProperty("message", out var messageEl)
            ? messageEl.GetString() ?? ""
            : "";
        if (string.IsNullOrWhiteSpace(description))
            description = string.IsNullOrWhiteSpace(locationLabel)
                ? "Acil yardım çağrısı. Konum alınamadı."
                : $"Acil yardım çağrısı. Konum: {locationLabel}";

        var alert = new StoredEmergencyAlert
        {
            Id = Guid.NewGuid().ToString("N"),
            ElderlyId = elderlyId,
            AlertType = payload.TryGetProperty("type", out var typeEl) ? typeEl.GetString() ?? "emergency" : "emergency",
            Description = description,
            OccurredAt = DateTime.UtcNow,
            LocationLabel = locationLabel,
            MapsUrl = mapsUrl,
            Latitude = latitude,
            Longitude = longitude,
            AccuracyMeters = accuracy
        };
        _db.EmergencyAlerts.Add(alert);

        _db.Notifications.Add(new StoredNotification
        {
            ElderlyId = elderlyId,
            Type = "emergency_alert",
            Message = description,
            Severity = "high"
        });
        alert.NotificationStored = true;

        var broadcastPayload = new
        {
            elderlyId,
            elderlyName,
            alertId = alert.Id,
            type = "emergency_alert",
            message = description,
            location = string.IsNullOrWhiteSpace(mapsUrl) ? locationLabel : mapsUrl,
            coords = latitude is null || longitude is null
                ? null
                : new { latitude, longitude, accuracy },
            timestamp = DateTime.UtcNow
        };

        var realtimeOk = false;
        try
        {
            await hub.Clients.Group("family:all").SendAsync("ReceiveEmergencyBroadcast", broadcastPayload, cancellationToken);
            await hub.Clients.Group($"family:{elderlyId}").SendAsync("ReceiveEmergencyBroadcast", broadcastPayload, cancellationToken);
            await hub.Clients.All.SendAsync("ReceiveEmergencyAlert", broadcastPayload, cancellationToken);
            realtimeOk = true;
        }
        catch
        {
            realtimeOk = false;
        }
        alert.RealtimeBroadcasted = realtimeOk;

        var pushSent = 0;
        try
        {
            var familyUserIds = await _db.Users.AsNoTracking()
                .Where(x => x.AccountType == "Family" && x.ElderlyOwnerId == elderlyId)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (familyUserIds.Count > 0)
            {
                var registrations = await _db.DeviceRegistrations.AsNoTracking()
                    .Where(x => familyUserIds.Contains(x.UserId))
                    .ToListAsync(cancellationToken);
                var protector = dataProtection.CreateProtector("SafeGuardian.DeviceTokens.v1");
                foreach (var reg in registrations)
                {
                    string? token = null;
                    try { token = protector.Unprotect(reg.EncryptedToken); }
                    catch { continue; }
                    if (string.IsNullOrWhiteSpace(token)) continue;
                    var isIos = reg.Platform.Contains("ios", StringComparison.OrdinalIgnoreCase)
                        || reg.Platform.Contains("iphone", StringComparison.OrdinalIgnoreCase);
                    var sent = await push.SendAsync(new PushNotification
                    {
                        UserId = reg.UserId,
                        Title = "ACİL YARDIM",
                        Body = $"{elderlyName}: {description}",
                        Type = PushNotificationService.NotificationTypes.Emergency,
                        Priority = "high",
                        Sound = "default",
                        Badge = 1,
                        FcmToken = isIos ? null : token,
                        ApnsToken = isIos ? token : null,
                        Data = new Dictionary<string, string>
                        {
                            ["action"] = "open_emergency",
                            ["alertId"] = alert.Id,
                            ["elderlyId"] = elderlyId,
                            ["location"] = mapsUrl
                        }
                    });
                    if (sent) pushSent++;
                }
            }
        }
        catch
        {
            // Push is best-effort; SMS/realtime still matter.
        }

        var smsDispatched = 0;
        var smsConfigured = sms.IsConfigured;
        var smsError = (string?)null;
        if (smsConfigured)
        {
            var dailyLimit = configuration.GetValue("Sms:DailyPerUserLimit", 10);
            var sentToday = await _db.SmsDispatchAudits
                .CountAsync(x => x.UserId == UserId()
                    && x.Succeeded
                    && x.CreatedAt >= DateTime.UtcNow.AddHours(-24), cancellationToken);
            if (sentToday >= dailyLimit)
            {
                smsError = "Günlük SMS güvenlik limiti aşıldı.";
            }
            else
            {
                var phones = await _db.FamilyMembers.AsNoTracking()
                    .Where(x => x.ElderlyId == elderlyId && x.PhoneNumber != "")
                    .Select(x => x.PhoneNumber)
                    .ToListAsync(cancellationToken);
                var allowed = phones.Select(NormalizePhone)
                    .Where(x => x.Length >= 10)
                    .Distinct(StringComparer.Ordinal)
                    .Take(Math.Max(0, dailyLimit - sentToday))
                    .ToArray();
                var smsBody = string.IsNullOrWhiteSpace(mapsUrl)
                    ? $"ACIL DURUM! {elderlyName} yardım istedi. Konum alınamadı."
                    : $"ACIL DURUM! {elderlyName} yardım istedi. Konum: {mapsUrl}";
                smsBody = smsBody[..Math.Min(smsBody.Length, 500)];
                foreach (var recipient in allowed)
                {
                    var succeeded = await sms.SendAsync(recipient, smsBody, cancellationToken);
                    _db.SmsDispatchAudits.Add(new SmsDispatchAudit
                    {
                        UserId = UserId(),
                        RecipientHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(recipient))),
                        Succeeded = succeeded,
                        CreatedAt = DateTime.UtcNow
                    });
                    if (succeeded) smsDispatched++;
                }
                if (allowed.Length == 0)
                    smsError = "Kayıtlı aile telefonu bulunamadı.";
                else if (smsDispatched == 0)
                    smsError = "SMS gönderilemedi.";
            }
        }
        else
        {
            smsError = "SMS sağlayıcısı yapılandırılmamış.";
        }
        alert.SmsDispatched = smsDispatched > 0;

        await _db.SaveChangesAsync(cancellationToken);

        var locationSaved = !string.IsNullOrWhiteSpace(locationLabel) || latitude is not null;
        var familyReached = realtimeOk || smsDispatched > 0 || pushSent > 0;
        return Results.Ok(new
        {
            success = true,
            acknowledged = true,
            alertId = alert.Id,
            locationSaved,
            location = locationLabel,
            mapsUrl,
            notificationStored = true,
            realtimeBroadcasted = realtimeOk,
            pushSent,
            smsConfigured,
            smsDispatched,
            smsError,
            familyReached,
            message = familyReached
                ? "Acil yardım kaydı oluşturuldu ve aileye iletim denendi."
                : "Acil yardım kaydı oluşturuldu ancak aileye iletim doğrulanamadı."
        });
    }

    private static (string Label, string MapsUrl, double? Latitude, double? Longitude, double? Accuracy)
        ParseEmergencyLocation(JsonElement payload)
    {
        string label = "";
        string mapsUrl = "";
        double? latitude = null;
        double? longitude = null;
        double? accuracy = null;

        if (payload.TryGetProperty("location", out var locationEl))
        {
            if (locationEl.ValueKind == JsonValueKind.String)
            {
                label = locationEl.GetString()?.Trim() ?? "";
                if (label.Contains("maps.google", StringComparison.OrdinalIgnoreCase)
                    || label.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    mapsUrl = label;
            }
            else if (locationEl.ValueKind == JsonValueKind.Object)
            {
                if (locationEl.TryGetProperty("latitude", out var latEl) && latEl.TryGetDouble(out var lat))
                    latitude = lat;
                if (locationEl.TryGetProperty("longitude", out var lngEl) && lngEl.TryGetDouble(out var lng))
                    longitude = lng;
                if (locationEl.TryGetProperty("accuracy", out var accEl) && accEl.TryGetDouble(out var acc))
                    accuracy = acc;
                if (locationEl.TryGetProperty("mapsUrl", out var mapsEl))
                    mapsUrl = mapsEl.GetString()?.Trim() ?? "";
                if (locationEl.TryGetProperty("label", out var labelEl))
                    label = labelEl.GetString()?.Trim() ?? "";
            }
        }

        if (payload.TryGetProperty("coords", out var coordsEl) && coordsEl.ValueKind == JsonValueKind.Object)
        {
            if (latitude is null && coordsEl.TryGetProperty("latitude", out var lat2) && lat2.TryGetDouble(out var latV))
                latitude = latV;
            if (longitude is null && coordsEl.TryGetProperty("longitude", out var lng2) && lng2.TryGetDouble(out var lngV))
                longitude = lngV;
            if (accuracy is null && coordsEl.TryGetProperty("accuracy", out var acc2) && acc2.TryGetDouble(out var accV))
                accuracy = accV;
        }

        if (latitude is not null && longitude is not null)
        {
            if (string.IsNullOrWhiteSpace(label))
                label = $"{latitude.Value:F5}, {longitude.Value:F5}";
            if (string.IsNullOrWhiteSpace(mapsUrl))
                mapsUrl = $"https://maps.google.com/?q={latitude.Value},{longitude.Value}";
        }

        return (label, mapsUrl, latitude, longitude, accuracy);
    }

    [HttpPost("emergency-sms/test")]
    public IResult EmergencySmsTest() => Results.Ok(new
    {
        success = true,
        simulated = true,
        smsDispatched = false
    });

    [Authorize(Roles = "Elderly")]
    [EnableRateLimiting("sms")]
    [HttpPost("emergency-sms/dispatch")]
    public async Task<IResult> DispatchEmergencySms(
        [FromBody] EmergencySmsRequest request,
        [FromServices] EmergencySmsService sms,
        [FromServices] IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var elderlyId = ElderlyId();
        var dailyLimit = configuration.GetValue("Sms:DailyPerUserLimit", 10);
        var sentToday = await _db.SmsDispatchAudits
            .CountAsync(x => x.UserId == UserId()
                && x.Succeeded
                && x.CreatedAt >= DateTime.UtcNow.AddHours(-24), cancellationToken);
        if (sentToday >= dailyLimit)
            return Results.Json(new { success = false, message = "Günlük SMS güvenlik limiti aşıldı." }, statusCode: 429);
        if (!sms.IsConfigured)
            return Results.Json(new { success = false, message = "SMS provider is not configured." }, statusCode: 503);

        var allowed = await _db.FamilyMembers.AsNoTracking()
            .Where(x => x.ElderlyId == elderlyId && x.PhoneNumber != "")
            .Select(x => x.PhoneNumber)
            .ToListAsync(cancellationToken);
        var allowedNormalized = allowed.Select(NormalizePhone)
            .Where(x => x.Length >= 10)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (allowedNormalized.Length == 0)
            return Results.BadRequest(new { success = false, message = "Kayıtlı acil durum alıcısı bulunamadı." });

        var message = (request.Message ?? "SafeGuardian acil yardım isteği.").Trim();
        if (!string.IsNullOrWhiteSpace(request.Location))
            message = $"{message}\nKonum: {request.Location.Trim()}";
        message = message[..Math.Min(message.Length, 500)];

        var sent = 0;
        foreach (var recipient in allowedNormalized.Take(Math.Max(0, dailyLimit - sentToday)))
        {
            var succeeded = await sms.SendAsync(recipient, message, cancellationToken);
            _db.SmsDispatchAudits.Add(new SmsDispatchAudit
            {
                UserId = UserId(),
                RecipientHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(recipient))),
                Succeeded = succeeded,
                CreatedAt = DateTime.UtcNow
            });
            if (succeeded) sent++;
        }
        await _db.SaveChangesAsync(cancellationToken);
        return sent > 0
            ? Results.Ok(new { success = true, dispatched = sent })
            : Results.Json(new { success = false, message = "SMS gönderilemedi." }, statusCode: 502);
    }

    [HttpPost("chat")]
    public IResult Chat([FromBody] ChatRequest request) => Results.Ok(new
    {
        success = true,
        reply = string.IsNullOrWhiteSpace(request.Message)
            ? "Size nasıl yardımcı olabilirim?"
            : "Mesajınız alındı. Acil bir durum varsa acil yardım düğmesini kullanın."
    });

    private string UserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")
        ?? throw new UnauthorizedAccessException();

    private string ElderlyId() =>
        User.FindFirstValue("elderly_id") is { Length: > 0 } id
            ? id
            : throw new UnauthorizedAccessException();

    private static string[] DeserializeTimes(string json)
    {
        try { return JsonSerializer.Deserialize<string[]>(json) ?? []; }
        catch { return []; }
    }

    private static string NormalizePhone(string value)
    {
        var trimmed = (value ?? "").Trim();
        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        return trimmed.StartsWith('+') ? $"+{digits}" : digits;
    }

    private static object ToMedicationResponse(StoredMedication medication) => new
    {
        medication.Id,
        medication.Name,
        medication.Notes,
        scheduleTimes = DeserializeTimes(medication.ScheduleTimesJson),
        medication.StockCount,
        medication.LastTakenAt,
        medication.CreatedAt
    };
}

public sealed record FamilyAccountRequest(string Name, string Email, string? Phone);
public sealed record MoodRequest(int MoodScore);
public sealed record HealthRecordRequest(string RecordType, double Value, string Unit);
public sealed record MedicationRequest(string Name, string? Notes, string[]? ScheduleTimes);
public sealed record FamilyMemberRequest(
    string Name,
    string Email,
    string? Relationship,
    string? PhoneNumber);
public sealed record NotificationRequest(string Message, string? Type, string? Severity);
public sealed record ChatRequest(string Message);
public sealed record EmergencySmsRequest(string? Message, string? Location);
