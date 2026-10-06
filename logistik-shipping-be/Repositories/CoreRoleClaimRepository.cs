using Dapper;
using LogistikShipping.Api.Models;

namespace LogistikShipping.Api.Repositories;

public interface ICoreRoleClaimRepository
{
    Task<IEnumerable<CoreRoleClaim>> GetByRoleIdAsync(Guid roleId);
    Task<CoreRoleClaim> AddAsync(AddCoreRoleClaimRequest req);
    /// <summary>Replaces the user set of a role: listed UPNs are (re)activated, the rest are deactivated.</summary>
    Task ReplaceAsync(Guid roleId, IEnumerable<string> userPrincipalNames, bool isActive, string updatedBy);
}

public class CoreRoleClaimRepository : ICoreRoleClaimRepository
{
    private readonly IDbConnectionFactory _db;
    public CoreRoleClaimRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<CoreRoleClaim>> GetByRoleIdAsync(Guid roleId)
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreRoleClaim>(
            "SELECT * FROM dbo.CORE_RoleClaim WHERE RoleId = @roleId AND IsActive = 1 ORDER BY EmployeeName", new { roleId });
    }

    public async Task<CoreRoleClaim> AddAsync(AddCoreRoleClaimRequest req)
    {
        using var c = _db.Create();
        return await c.QuerySingleAsync<CoreRoleClaim>(
            @"MERGE dbo.CORE_RoleClaim AS t
              USING (SELECT @RoleId AS RoleId, @UserPrincipalName AS Upn) AS s
                 ON t.RoleId = s.RoleId AND t.UserPrincipalName = s.Upn
              WHEN MATCHED THEN UPDATE SET EmployeeName = @EmployeeName, IsActive = @IsActive,
                                           UpdatedBy = @CreatedBy, UpdatedDate = SYSDATETIME()
              WHEN NOT MATCHED THEN INSERT (RoleId, UserPrincipalName, EmployeeName, IsActive, CreatedBy)
                                    VALUES (@RoleId, @UserPrincipalName, @EmployeeName, @IsActive, @CreatedBy)
              OUTPUT INSERTED.*;", req);
    }

    public async Task ReplaceAsync(Guid roleId, IEnumerable<string> userPrincipalNames, bool isActive, string updatedBy)
    {
        var upns = userPrincipalNames.Select(u => u.Trim()).Where(u => u.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        using var c = _db.Create();
        c.Open();
        using var tx = c.BeginTransaction();

        await c.ExecuteAsync(
            @"UPDATE dbo.CORE_RoleClaim SET IsActive = 0, UpdatedBy = @updatedBy, UpdatedDate = SYSDATETIME()
              WHERE RoleId = @roleId AND UserPrincipalName NOT IN @upns",
            new { roleId, updatedBy, upns = upns.Count == 0 ? new[] { "" } : upns.ToArray() }, tx);

        foreach (var upn in upns)
        {
            await c.ExecuteAsync(
                @"MERGE dbo.CORE_RoleClaim AS t
                  USING (SELECT @roleId AS RoleId, @upn AS Upn) AS s
                     ON t.RoleId = s.RoleId AND t.UserPrincipalName = s.Upn
                  WHEN MATCHED THEN UPDATE SET IsActive = @isActive, UpdatedBy = @updatedBy, UpdatedDate = SYSDATETIME()
                  WHEN NOT MATCHED THEN INSERT (RoleId, UserPrincipalName, EmployeeName, IsActive, CreatedBy)
                                        VALUES (@roleId, @upn, @upn, @isActive, @updatedBy);",
                new { roleId, upn, isActive, updatedBy }, tx);
        }

        tx.Commit();
    }
}
