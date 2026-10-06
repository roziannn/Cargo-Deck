using Dapper;
using LogistikShipping.Api.Models;

namespace LogistikShipping.Api.Repositories;

public interface ICoreMenuRepository
{
    Task<IEnumerable<CoreMenuRow>> GetMenusAsync();
    Task<IEnumerable<CoreMenuFunctionRow>> GetFunctionsAsync();
    Task<IEnumerable<CoreRoleMenuRow>> GetRoleMenusAsync(Guid roleNewId);
    Task<IEnumerable<CoreRoleMenuRow>> GetRoleMenusByUserAsync(string userPrincipalName);
    Task<CoreMenuRow> CreateMenuAsync(CreateCoreMenuRequest req);
    Task<bool> UpdateMenuAsync(Guid newId, UpdateCoreMenuRequest req);
    Task<CoreMenuFunctionRow> CreateFunctionAsync(CreateCoreMenuComponentRequest req);
    Task<bool> SetMenuAccessAsync(Guid roleNewId, Guid menuNewId, bool isActive);
    Task<bool> SetFunctionAccessAsync(Guid roleNewId, Guid functionNewId, bool isActive);
}

public class CoreMenuRepository : ICoreMenuRepository
{
    private readonly IDbConnectionFactory _db;
    public CoreMenuRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IEnumerable<CoreMenuRow>> GetMenusAsync()
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreMenuRow>("SELECT * FROM dbo.CORE_Menu ORDER BY ISNULL(Seq, 2147483647), Name");
    }

    public async Task<IEnumerable<CoreMenuFunctionRow>> GetFunctionsAsync()
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreMenuFunctionRow>("SELECT Id, NewId, Name, MenuNewId, Path, IsActive FROM dbo.CORE_MenuFunction ORDER BY Id");
    }

    public async Task<IEnumerable<CoreRoleMenuRow>> GetRoleMenusAsync(Guid roleNewId)
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreRoleMenuRow>(
            "SELECT MenuNewId, FunctionNewId, IsActive, IsActiveBtn FROM dbo.CORE_RoleMenu WHERE RoleNewId = @roleNewId", new { roleNewId });
    }

    public async Task<IEnumerable<CoreRoleMenuRow>> GetRoleMenusByUserAsync(string userPrincipalName)
    {
        using var c = _db.Create();
        return await c.QueryAsync<CoreRoleMenuRow>(
            @"SELECT rm.MenuNewId, rm.FunctionNewId,
                     CAST(MAX(CAST(rm.IsActive AS INT)) AS BIT)    AS IsActive,
                     CAST(MAX(CAST(rm.IsActiveBtn AS INT)) AS BIT) AS IsActiveBtn
              FROM dbo.CORE_RoleClaim rc
              JOIN dbo.CORE_Role r      ON r.NewId = rc.RoleId AND r.IsActive = 1
              JOIN dbo.CORE_RoleMenu rm ON rm.RoleNewId = rc.RoleId
              WHERE rc.UserPrincipalName = @userPrincipalName AND rc.IsActive = 1
              GROUP BY rm.MenuNewId, rm.FunctionNewId", new { userPrincipalName });
    }

    public async Task<CoreMenuRow> CreateMenuAsync(CreateCoreMenuRequest req)
    {
        using var c = _db.Create();
        return await c.QuerySingleAsync<CoreMenuRow>(
            @"INSERT INTO dbo.CORE_Menu (Name, ParentId, Seq, Icon, Path, IsVisible, IsActive, IsDevelopment, CreatedBy)
              OUTPUT INSERTED.*
              VALUES (@Name, @ParentId, @Seq, @Icon, @Path, @IsVisible, @IsActive, @IsDevelopment, @CreatedBy)", req);
    }

    public async Task<bool> UpdateMenuAsync(Guid newId, UpdateCoreMenuRequest req)
    {
        using var c = _db.Create();
        var rows = await c.ExecuteAsync(
            @"UPDATE dbo.CORE_Menu
              SET Name = @Name, ParentId = @ParentId, Seq = @Seq, Icon = @Icon, Path = @Path,
                  IsVisible = @IsVisible, IsActive = @IsActive, IsDevelopment = @IsDevelopment,
                  UpdatedBy = @UpdatedBy, UpdatedDate = SYSDATETIME()
              WHERE NewId = @newId",
            new { req.Name, req.ParentId, req.Seq, req.Icon, req.Path, req.IsVisible, req.IsActive, req.IsDevelopment, req.UpdatedBy, newId });
        return rows > 0;
    }

    public async Task<CoreMenuFunctionRow> CreateFunctionAsync(CreateCoreMenuComponentRequest req)
    {
        using var c = _db.Create();
        return await c.QuerySingleAsync<CoreMenuFunctionRow>(
            @"INSERT INTO dbo.CORE_MenuFunction (Name, MenuNewId, Path, IsActive, CreatedBy)
              OUTPUT INSERTED.Id, INSERTED.NewId, INSERTED.Name, INSERTED.MenuNewId, INSERTED.Path, INSERTED.IsActive
              VALUES (@Name, @MenuNewId, @Path, @IsActiveBtn, @CreatedBy)", req);
    }

    public async Task<bool> SetMenuAccessAsync(Guid roleNewId, Guid menuNewId, bool isActive)
    {
        using var c = _db.Create();
        await c.ExecuteAsync(
            @"MERGE dbo.CORE_RoleMenu AS t
              USING (SELECT @roleNewId AS R, @menuNewId AS M) AS s
                 ON t.RoleNewId = s.R AND t.MenuNewId = s.M AND t.FunctionNewId IS NULL
              WHEN MATCHED THEN UPDATE SET IsActive = @isActive, UpdatedDate = SYSDATETIME()
              WHEN NOT MATCHED THEN INSERT (RoleNewId, MenuNewId, FunctionNewId, IsActive, IsActiveBtn)
                                    VALUES (@roleNewId, @menuNewId, NULL, @isActive, 0);",
            new { roleNewId, menuNewId, isActive });
        return true;
    }

    public async Task<bool> SetFunctionAccessAsync(Guid roleNewId, Guid functionNewId, bool isActive)
    {
        using var c = _db.Create();
        var menuNewId = await c.QuerySingleOrDefaultAsync<Guid?>(
            "SELECT MenuNewId FROM dbo.CORE_MenuFunction WHERE NewId = @functionNewId", new { functionNewId });
        if (menuNewId is null) return false;

        await c.ExecuteAsync(
            @"MERGE dbo.CORE_RoleMenu AS t
              USING (SELECT @roleNewId AS R, @menuNewId AS M, @functionNewId AS F) AS s
                 ON t.RoleNewId = s.R AND t.MenuNewId = s.M AND t.FunctionNewId = s.F
              WHEN MATCHED THEN UPDATE SET IsActiveBtn = @isActive, UpdatedDate = SYSDATETIME()
              WHEN NOT MATCHED THEN INSERT (RoleNewId, MenuNewId, FunctionNewId, IsActive, IsActiveBtn)
                                    VALUES (@roleNewId, @menuNewId, @functionNewId, 0, @isActive);",
            new { roleNewId, menuNewId, functionNewId, isActive });
        return true;
    }
}
