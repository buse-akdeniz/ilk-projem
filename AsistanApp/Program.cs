using ilk_projem.Data;
using ilk_projem.Services;
using AsistanApp.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using ilk_projem.Controllers;
using ilk_projem.Hubs;
using ilk_projem.Models.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────────────
// Production: use DATABASE_URL env var (PostgreSQL on Railway)
// Fallback: SQLite for local dev
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    if (databaseUrl.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || databaseUrl.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(databaseUrl);
        var credentials = uri.UserInfo.Split(':', 2);
        databaseUrl =
            $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};" +
            $"Username={Uri.UnescapeDataString(credentials[0])};" +
            $"Password={Uri.UnescapeDataString(credentials.ElementAtOrDefault(1) ?? "")};SSL Mode=Require;Trust Server Certificate=true";
    }
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(databaseUrl));
}
else if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite("Data Source=asistan.db"));
}
else
{
    throw new InvalidOperationException("Production database configuration is required.");
}

// ── Core services ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddHttpClient();
var keyStoragePath = builder.Configuration["DataProtection:KeyStoragePath"];
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("SafeGuardian");
if (!string.IsNullOrWhiteSpace(keyStoragePath))
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keyStoragePath));
builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 10;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

var jwtSecret = builder.Configuration["Jwt:SecretKey"] ?? "";
if (builder.Environment.IsProduction()
    && (jwtSecret.Length < 32
        || jwtSecret.StartsWith("YOUR_", StringComparison.Ordinal)
        || string.IsNullOrWhiteSpace(builder.Configuration["RevenueCat:WebhookAuthKey"])
        || string.IsNullOrWhiteSpace(builder.Configuration["Email:Username"])
        || string.IsNullOrWhiteSpace(builder.Configuration["Email:Password"])
        || string.IsNullOrWhiteSpace(builder.Configuration["App:PublicBaseUrl"])
        || string.IsNullOrWhiteSpace(builder.Configuration["Sms:Twilio:AccountSid"])
        || string.IsNullOrWhiteSpace(builder.Configuration["Sms:Twilio:AuthToken"])
        || string.IsNullOrWhiteSpace(builder.Configuration["Sms:FromNumber"])))
    throw new InvalidOperationException("Production database, JWT, RevenueCat, email, SMS and public URL configuration is required.");
if (jwtSecret.Length < 32)
    throw new InvalidOperationException("Jwt:SecretKey must contain at least 32 characters.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.AddFixedWindowLimiter("sms", limiter =>
    {
        limiter.PermitLimit = 3;
        limiter.Window = TimeSpan.FromHours(1);
        limiter.QueueLimit = 0;
    });
});

// ── CORS ──────────────────────────────────────────────────────────────────────
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (!builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
    throw new InvalidOperationException("At least one production CORS origin is required.");
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (allowedOrigins.Length > 0)
        p.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
    else
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
}));

// ── Application services ──────────────────────────────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AccountEmailService>();
builder.Services.AddScoped<EmergencySmsService>();
builder.Services.AddScoped<SubscriptionService>();
builder.Services.AddSingleton<AdMobSsvVerifier>();
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddScoped<PushNotificationService>();

// ── Logging ───────────────────────────────────────────────────────────────────
builder.Logging.AddConsole();
if (!builder.Environment.IsDevelopment())
    builder.Logging.SetMinimumLevel(LogLevel.Warning);

var app = builder.Build();

// ── Security headers ──────────────────────────────────────────────────────────
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"]  = "nosniff";
    ctx.Response.Headers["X-Frame-Options"]         = "DENY";
    ctx.Response.Headers["X-XSS-Protection"]        = "1; mode=block";
    ctx.Response.Headers["Referrer-Policy"]         = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"]      = "camera=(), microphone=(), geolocation=(self)";
    await next();
});

// ── Forwarded headers (Railway / reverse proxy) ───────────────────────────────
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// ── Static files + SPA ───────────────────────────────────────────────────────
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// ── Apply versioned database migrations on startup ───────────────────────────
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await DatabaseBootstrapper.MigrateAsync(db, app.Logger);
        await IdentitySeeder.SeedAsync(scope.ServiceProvider, builder.Configuration);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Database migration failed — {Message}", ex.Message);
        throw;
    }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.MapControllers();
app.MapHub<HealthReportHub>("/hubs/health");
app.MapStateEndpoints();
app.MapAdEndpoints();
app.MapDeviceEndpoints();

// Health checks
app.MapGet("/health/live",  () => Results.Ok(new { ok = true, ts = DateTime.UtcNow }));
app.MapGet("/health/ready", async (AppDbContext db) =>
{
    try { await db.Database.CanConnectAsync(); return Results.Ok(new { ok = true }); }
    catch (Exception ex) { return Results.Json(new { ok = false, error = ex.Message }, statusCode: 503); }
});

// Analytics event ingestion endpoint (called from mobile/web)
app.MapPost("/api/analytics/event", async (HttpContext ctx, AnalyticsService analytics) =>
{
    var json    = await System.Text.Json.JsonDocument.ParseAsync(ctx.Request.Body);
    var evt     = json.RootElement.TryGetProperty("event", out var e) ? e.GetString() ?? "" : "";
    await analytics.TrackAsync(evt, ctx.User.FindFirst("elderly_id")?.Value);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.Run();

public partial class Program;
