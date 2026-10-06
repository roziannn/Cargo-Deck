using Dapper;
using LogistikShipping.Api.Models;

namespace LogistikShipping.Api.Repositories;

public interface ICoreRoleRepository
{
    Task<IEnumerable<CoreRole>> GetAllAsync();
    Task<CoreRole?> GetByNewIdAsync(Guid newId);
    Task<CoreRole> CreateAsync(CreateCoreRoleRequest req);
    Task<bool> UpdateAsync(Guid newId, UpdateCoreRoleRequest req);
}

public class CoreRoleRepository : ICoreRoleRepository
{
    private readonly IDbConnectionFactory _db;
    public CoreRoleRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<CoreRole>> GetAllAsync()
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreRole>("SELECT * FROM dbo.CORE_Role ORDER BY Name");
    }

    public async Task<CoreRole?> GetByNewIdAsync(Guid newId)
    {
        using var c = _db.Create();
        return await c.QuerySingleOrDefaultAsync<CoreRole>("SELECT * FROM dbo.CORE_Role WHERE NewId = @newId", new { newId });
    }

    public async Task<CoreRole> CreateAsync(CreateCoreRoleRequest req)
    {
        using var c = _db.Create();
        return await c.QuerySingleAsync<CoreRole>(
            @"INSERT INTO dbo.CORE_Role (Name, IsActive, CreatedBy)
              OUTPUT INSERTED.*
              VALUES (@Name, @IsActive, @CreatedBy)", req);
    }

    public async Task<bool> UpdateAsync(Guid newId, UpdateCoreRoleRequest req)
    {
        using var c = _db.Create();
        var rows = await c.ExecuteAsync(
            @"UPDATE dbo.CORE_Role
              SET Name = @Name, IsActive = @IsActive, UpdatedBy = @UpdatedBy, UpdatedDate = SYSDATETIME()
              WHERE NewId = @newId",
            new { req.Name, req.IsActive, req.UpdatedBy, newId });
        return rows > 0;
    }
}
