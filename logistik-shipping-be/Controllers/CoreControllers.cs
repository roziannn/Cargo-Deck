using Asp.Versioning;
using LogistikShipping.Api.Models;
using LogistikShipping.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LogistikShipping.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/CoreRole")]
public class CoreRoleController : ControllerBase
{
    private readonly ICoreRoleService _service;
    public CoreRoleController(ICoreRoleService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create(CreateCoreRoleRequest req) => Ok(await _service.CreateAsync(req));

    [HttpPut("{newId:guid}")]
    public async Task<IActionResult> Update(Guid newId, UpdateCoreRoleRequest req) =>
        await _service.UpdateAsync(newId, req) ? NoContent() : NotFound();
}

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/CoreRoleClaim")]
public class CoreRoleClaimController : ControllerBase
{
    private readonly ICoreRoleClaimService _service;
    public CoreRoleClaimController(ICoreRoleClaimService service) => _service = service;

    [HttpGet("by-roleid/{roleId:guid}")]
    public async Task<IActionResult> GetByRoleId(Guid roleId) => Ok(await _service.GetByRoleIdAsync(roleId));

    [HttpPost("add")]
    public async Task<IActionResult> Add(AddCoreRoleClaimRequest req) => Ok(await _service.AddAsync(req));

    [HttpPut("update/{roleId:guid}")]
    public async Task<IActionResult> Update(Guid roleId, UpdateCoreRoleClaimRequest req) =>
        await _service.UpdateAsync(roleId, req) ? NoContent() : NotFound();
}

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/CoreMenu")]
public class CoreMenuController : ControllerBase
{
    private readonly ICoreMenuService _service;
    public CoreMenuController(ICoreMenuService service) => _service = service;

    [HttpGet("MasterMenu")]
    public async Task<IActionResult> GetMaster() => Ok(await _service.GetMasterAsync());

    [HttpGet("{roleId:guid}")]
    public async Task<IActionResult> GetByRole(Guid roleId) => Ok(await _service.GetByRoleAsync(roleId));

    [HttpGet("Sidebar/{userPrincipalName}")]
    public async Task<IActionResult> GetSidebar(string userPrincipalName) => Ok(await _service.GetSidebarAsync(userPrincipalName));

    [HttpPost]
    public async Task<IActionResult> Create(CreateCoreMenuRequest req) => Ok(await _service.CreateAsync(req));

    [HttpPut("{newId:guid}")]
    public async Task<IActionResult> Update(Guid newId, UpdateCoreMenuRequest req) =>
        await _service.UpdateAsync(newId, req) ? NoContent() : NotFound();

    [HttpPost("menu-component/create")]
    public async Task<IActionResult> CreateComponent(CreateCoreMenuComponentRequest req) => Ok(await _service.CreateComponentAsync(req));

    [HttpPut("role/{roleNewId:guid}/menu/{menuNewId:guid}")]
    public async Task<IActionResult> SetMenuAccess(Guid roleNewId, Guid menuNewId, UpdateRoleMenuAccessRequest req) =>
        await _service.SetMenuAccessAsync(roleNewId, menuNewId, req.IsActive) ? NoContent() : NotFound();

    [HttpPut("role/{roleNewId:guid}/function/{functionNewId:guid}")]
    public async Task<IActionResult> SetFunctionAccess(Guid roleNewId, Guid functionNewId, UpdateRoleMenuAccessRequest req) =>
        await _service.SetFunctionAccessAsync(roleNewId, functionNewId, req.IsActive) ? NoContent() : NotFound();
}
