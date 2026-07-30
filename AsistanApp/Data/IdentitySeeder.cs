using ilk_projem.Models.Persistence;
using Microsoft.AspNetCore.Identity;

namespace ilk_projem.Data;

public static class IdentitySeeder
{
    public static async Task SeedAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Elderly", "Family" })
        {
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
        }

        var elderlyEmail = configuration["AppReview:ElderlyEmail"];
        var elderlyPassword = configuration["AppReview:ElderlyPassword"];
        if (string.IsNullOrWhiteSpace(elderlyEmail) || string.IsNullOrWhiteSpace(elderlyPassword))
            return;

        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var elderly = await EnsureUserAsync(
            users, elderlyEmail, elderlyPassword, "Ayşe", "Elderly", null);

        var familyEmail = configuration["AppReview:FamilyEmail"];
        var familyPassword = configuration["AppReview:FamilyPassword"];
        if (!string.IsNullOrWhiteSpace(familyEmail) && !string.IsNullOrWhiteSpace(familyPassword))
        {
            await EnsureUserAsync(
                users, familyEmail, familyPassword, "Mehmet", "Family", elderly.Id);
        }
    }

    private static async Task<ApplicationUser> EnsureUserAsync(
        UserManager<ApplicationUser> users,
        string email,
        string password,
        string displayName,
        string accountType,
        string? elderlyOwnerId)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is not null) return user;

        user = new ApplicationUser
        {
            Id = Guid.NewGuid().ToString("N"),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = displayName.Trim(),
            AccountType = accountType,
            ElderlyOwnerId = elderlyOwnerId,
            LockoutEnabled = true
        };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
            throw new InvalidOperationException(
                $"App Review account could not be created: {string.Join(", ", created.Errors.Select(e => e.Description))}");
        await users.AddToRoleAsync(user, accountType);
        return user;
    }
}
