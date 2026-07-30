using ilk_projem.Data;
using Microsoft.EntityFrameworkCore;

namespace ilk_projem.Services;

public static class DatabaseBootstrapper
{
    private const string InitialMigrationId = "20260718151914_InitialSecureProduction";

    public static async Task MigrateAsync(AppDbContext db, ILogger logger, CancellationToken cancellationToken = default)
    {
        var provider = db.Database.ProviderName ?? "";
        var isPostgres = provider.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);

        if (isPostgres && await NeedsSchemaResetAsync(db, cancellationToken))
        {
            logger.LogWarning(
                "Incompatible PostgreSQL schema detected. Resetting public schema before secure migration.");
            await db.Database.ExecuteSqlRawAsync(
                """
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                GRANT ALL ON SCHEMA public TO public;
                """,
                cancellationToken);
        }

        await db.Database.MigrateAsync(cancellationToken);
        await EnsureEmergencyLocationColumnsAsync(db, logger, cancellationToken);
    }

    private static async Task EnsureEmergencyLocationColumnsAsync(
        AppDbContext db,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "LocationLabel" text NOT NULL DEFAULT '';
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "MapsUrl" text NOT NULL DEFAULT '';
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "Latitude" double precision NULL;
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "Longitude" double precision NULL;
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "AccuracyMeters" double precision NULL;
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "NotificationStored" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "SmsDispatched" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "EmergencyAlerts" ADD COLUMN IF NOT EXISTS "RealtimeBroadcasted" boolean NOT NULL DEFAULT FALSE;
                """,
                cancellationToken);
        }
        catch (Exception ex)
        {
            // SQLite / local providers may not support IF NOT EXISTS the same way.
            logger.LogWarning(ex, "EmergencyAlerts location columns ensure skipped or partially applied.");
        }
    }

    private static async Task<bool> NeedsSchemaResetAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        if (await HasLegacySchemaWithoutMigrationsAsync(db, cancellationToken))
            return true;

        if (!await TableExistsAsync(db, "AspNetUsers", cancellationToken))
            return false;

        // Old SQLite-style migrations stored DateTime/bool incorrectly on Postgres.
        var createdAtType = await ColumnDataTypeAsync(db, "AspNetUsers", "CreatedAt", cancellationToken);
        if (string.Equals(createdAtType, "text", StringComparison.OrdinalIgnoreCase)
            || string.Equals(createdAtType, "integer", StringComparison.OrdinalIgnoreCase))
            return true;

        var emailConfirmedType = await ColumnDataTypeAsync(db, "AspNetUsers", "EmailConfirmed", cancellationToken);
        if (string.Equals(emailConfirmedType, "integer", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static async Task<bool> HasLegacySchemaWithoutMigrationsAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var applied = await db.Database.GetAppliedMigrationsAsync(cancellationToken);
        if (applied.Any(m => string.Equals(m, InitialMigrationId, StringComparison.Ordinal)))
            return false;

        var hasMigrationHistory = await TableExistsAsync(db, "__EFMigrationsHistory", cancellationToken);
        if (hasMigrationHistory)
        {
            var historyCount = await db.Database
                .SqlQueryRaw<long>("SELECT COUNT(*)::bigint AS \"Value\" FROM \"__EFMigrationsHistory\"")
                .SingleAsync(cancellationToken);
            if (historyCount > 0)
                return false;
        }

        return await TableExistsAsync(db, "EmergencyAlerts", cancellationToken)
            || await TableExistsAsync(db, "HealthRecords", cancellationToken)
            || await TableExistsAsync(db, "Subscriptions", cancellationToken);
    }

    private static async Task<string?> ColumnDataTypeAsync(
        AppDbContext db,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        return await db.Database
            .SqlQueryRaw<string>(
                "SELECT data_type AS \"Value\" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = {0} AND column_name = {1} LIMIT 1",
                tableName,
                columnName)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static async Task<bool> TableExistsAsync(
        AppDbContext db,
        string tableName,
        CancellationToken cancellationToken)
    {
        return await db.Database
            .SqlQueryRaw<bool>(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = {0}) AS \"Value\"",
                tableName)
            .SingleAsync(cancellationToken);
    }
}
