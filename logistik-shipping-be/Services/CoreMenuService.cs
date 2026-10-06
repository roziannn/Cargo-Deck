using LogistikShipping.Api.Models;
using LogistikShipping.Api.Repositories;

namespace LogistikShipping.Api.Services;

public interface ICoreMenuService
{
    Task<List<CoreMenuDto>> GetMasterAsync();
    Task<List<CoreMenuDto>> GetByRoleAsync(Guid roleNewId);
    Task<List<CoreMenuDto>> GetSidebarAsync(string userPrincipalName);
    Task<CoreMenuRow> CreateAsync(CreateCoreMenuRequest req);
    Task<bool> UpdateAsync(Guid newId, UpdateCoreMenuRequest req);
    Task<CoreMenuFunctionRow> CreateComponentAsync(CreateCoreMenuComponentRequest req);
    Task<bool> SetMenuAccessAsync(Guid roleNewId, Guid menuNewId, bool isActive);
    Task<bool> SetFunctionAccessAsync(Guid roleNewId, Guid functionNewId, bool isActive);
}

public class CoreMenuService : ICoreMenuService
{
    private readonly ICoreMenuRepository _repo;
    public CoreMenuService(ICoreMenuRepository repo) => _repo = repo;

    // Master tree: every menu/function with its own IsActive flag.
    public async Task<List<CoreMenuDto>> GetMasterAsync() =>
        BuildTree(await _repo.GetMenusAsync(), await _repo.GetFunctionsAsync(), null, false);

    // Role tree: every menu/function, IsActive reflects what the role has been granted.
    public async Task<List<CoreMenuDto>> GetByRoleAsync(Guid roleNewId) =>
        BuildTree(await _repo.GetMenusAsync(), await _repo.GetFunctionsAsync(), await _repo.GetRoleMenusAsync(roleNewId), false);

    // Sidebar: only granted + active + visible menus (and parents of granted children).
    public async Task<List<CoreMenuDto>> GetSidebarAsync(string userPrincipalName) =>
        BuildTree(await _repo.GetMenusAsync(), await _repo.GetFunctionsAsync(), await _repo.GetRoleMenusByUserAsync(userPrincipalName), true);

    public Task<CoreMenuRow> CreateAsync(CreateCoreMenuRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Menu name is required.");
        return _repo.CreateMenuAsync(req with { Name = req.Name.Trim() });
    }

    public Task<bool> UpdateAsync(Guid newId, UpdateCoreMenuRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Menu name is required.");
        if (req.ParentId == newId) throw new ArgumentException("A menu cannot be its own parent.");
        return _repo.UpdateMenuAsync(newId, req with { Name = req.Name.Trim() });
    }

    public Task<CoreMenuFunctionRow> CreateComponentAsync(CreateCoreMenuComponentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) throw new ArgumentException("Function name is required.");
        return _repo.CreateFunctionAsync(req with { Name = req.Name.Trim() });
    }

    public Task<bool> SetMenuAccessAsync(Guid roleNewId, Guid menuNewId, bool isActive) =>
        _repo.SetMenuAccessAsync(roleNewId, menuNewId, isActive);

    public Task<bool> SetFunctionAccessAsync(Guid roleNewId, Guid functionNewId, bool isActive) =>
        _repo.SetFunctionAccessAsync(roleNewId, functionNewId, isActive);

    /// <param name="access">null = master view (flags come from the menu tables); otherwise flags come from RoleMenu.</param>
    /// <param name="onlyGranted">sidebar mode: drop menus that are not granted/active/visible.</param>
    private static List<CoreMenuDto> BuildTree(
        IEnumerable<CoreMenuRow> menus,
        IEnumerable<CoreMenuFunctionRow> functions,
        IEnumerable<CoreRoleMenuRow>? access,
        bool onlyGranted)
    {
        var menuAccess = access?.Where(a => a.FunctionNewId is null).ToDictionary(a => a.MenuNewId, a => a.IsActive);
        var funcAccess = access?.Where(a => a.FunctionNewId is not null).ToDictionary(a => a.FunctionNewId!.Value, a => a.IsActiveBtn);

        var funcsByMenu = functions.GroupBy(f => f.MenuNewId).ToDictionary(g => g.Key, g => g.Select(f => new CoreMenuFunctionDto
        {
            NewId = f.NewId,
            Name = f.Name,
            Path = f.Path ?? "",
            IsActive = funcAccess is null ? f.IsActive : f.IsActive && funcAccess.GetValueOrDefault(f.NewId),
        }).ToList());

        var nodes = menus.ToDictionary(m => m.NewId, m => new CoreMenuDto
        {
            Id = m.Id, NewId = m.NewId, Name = m.Name, ParentId = m.ParentId, Seq = m.Seq,
            Icon = m.Icon ?? "", Path = m.Path ?? "",
            IsVisible = m.IsVisible, IsDevelopment = m.IsDevelopment,
            IsActive = menuAccess is null ? m.IsActive : m.IsActive && menuAccess.GetValueOrDefault(m.NewId),
            CreatedBy = m.CreatedBy, CreatedDate = m.CreatedDate, UpdatedBy = m.UpdatedBy, UpdatedDate = m.UpdatedDate,
            FunctionBtn = funcsByMenu.GetValueOrDefault(m.NewId) ?? new(),
        });

        var roots = new List<CoreMenuDto>();
        foreach (var node in nodes.Values)
        {
            if (node.ParentId is { } pid && nodes.TryGetValue(pid, out var parent)) parent.SubMenu.Add(node);
            else roots.Add(node);
        }

        if (!onlyGranted) return roots;

        bool Prune(CoreMenuDto n)
        {
            n.SubMenu = n.SubMenu.Where(Prune).ToList();
            return n.IsVisible && (n.IsActive || n.SubMenu.Count > 0);
        }
        return roots.Where(Prune).ToList();
    }
}
