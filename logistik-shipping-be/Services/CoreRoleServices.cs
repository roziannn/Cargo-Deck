using LogistikShipping.Api.Models;
using LogistikShipping.Api.Repositories;

namespace LogistikShipping.Api.Services;

public interface ICoreRoleService
{
    Task<IEnumerable<CoreRole>> GetAllAsync();
    Task<CoreRole> CreateAsync(CreateCoreRoleRequest req);
    Task<bool> UpdateAsync(Guid newId, UpdateCoreRoleRequest req);
}

public class CoreRoleService : ICoreRoleService
{
    private readonly ICoreRoleRepository _repo;
    public CoreRoleService(ICoreRoleRepository repo) => _repo = repo;

    public Task<IEnumerable<CoreRole>> GetAllAsync() => _repo.GetAllAsync();

    public Task<CoreRole> CreateAsync(CreateCoreRoleRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Role name is required.");
        return _repo.CreateAsync(req with { Name = req.Name.Trim() });
    }

    public Task<bool> UpdateAsync(Guid newId, UpdateCoreRoleRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Role name is required.");
        return _repo.UpdateAsync(newId, req with { Name = req.Name.Trim() });
    }
}

public interface ICoreRoleClaimService
{
    Task<IEnumerable<CoreRoleClaim>> GetByRoleIdAsync(Guid roleId);
    Task<CoreRoleClaim> AddAsync(AddCoreRoleClaimRequest req);
    Task<bool> UpdateAsync(Guid roleId, UpdateCoreRoleClaimRequest req);
}

public class CoreRoleClaimService : ICoreRoleClaimService
{
    private readonly ICoreRoleClaimRepository _repo;
    private readonly ICoreRoleRepository _roles;

    public CoreRoleClaimService(ICoreRoleClaimRepository repo, ICoreRoleRepository roles)
    {
        _repo = repo;
        _roles = roles;
    }

    public Task<IEnumerable<CoreRoleClaim>> GetByRoleIdAsync(Guid roleId) => _repo.GetByRoleIdAsync(roleId);

    public async Task<CoreRoleClaim> AddAsync(AddCoreRoleClaimRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserPrincipalName)) throw new ArgumentException("UserPrincipalName is required.");
        if (await _roles.GetByNewIdAsync(req.RoleId) is null) throw new KeyNotFoundException("Role not found.");
        return await _repo.AddAsync(req with { UserPrincipalName = req.UserPrincipalName.Trim() });
    }

    public async Task<bool> UpdateAsync(Guid roleId, UpdateCoreRoleClaimRequest req)
    {
        if (await _roles.GetByNewIdAsync(roleId) is null) return false;
        await _repo.ReplaceAsync(roleId, req.UserPrincipalNames ?? new(), req.IsActive, req.UpdatedBy);
        return true;
    }
}
