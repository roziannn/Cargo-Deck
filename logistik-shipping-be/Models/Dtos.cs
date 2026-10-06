namespace LogistikShipping.Api.Models;

// ---- Role ----
public class CoreRole
{
    public int Id { get; set; }
    public Guid NewId { get; set; }
    public string Name { get; set; } = "";
    public bool IsActive { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedDate { get; set; }
}

public record CreateCoreRoleRequest(string Name, bool IsActive, string CreatedBy);
public record UpdateCoreRoleRequest(string Name, bool IsActive, string UpdatedBy);

// ---- Role claim ----
public class CoreRoleClaim
{
    public int Id { get; set; }
    public Guid RoleId { get; set; }
    public string UserPrincipalName { get; set; } = "";
    public string? EmployeeName { get; set; }
    public bool IsActive { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedDate { get; set; }
}

public record AddCoreRoleClaimRequest(Guid RoleId, string UserPrincipalName, string? EmployeeName, bool IsActive, string CreatedBy);
public record UpdateCoreRoleClaimRequest(Guid RoleId, string? RoleName, List<string> UserPrincipalNames, string UpdatedBy, bool IsActive);

// ---- Menu ----
public class CoreMenuRow
{
    public int Id { get; set; }
    public Guid NewId { get; set; }
    public string Name { get; set; } = "";
    public Guid? ParentId { get; set; }
    public int? Seq { get; set; }
    public string? Icon { get; set; }
    public string? Path { get; set; }
    public bool IsDevelopment { get; set; }
    public bool IsVisible { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedDate { get; set; }
    public string? UpdatedBy { get; set; }
}

public class CoreMenuFunctionRow
{
    public int Id { get; set; }
    public Guid NewId { get; set; }
    public string Name { get; set; } = "";
    public Guid MenuNewId { get; set; }
    public string? Path { get; set; }
    public bool IsActive { get; set; }
}

public class CoreRoleMenuRow
{
    public Guid MenuNewId { get; set; }
    public Guid? FunctionNewId { get; set; }
    public bool IsActive { get; set; }
    public bool IsActiveBtn { get; set; }
}

public class CoreMenuFunctionDto
{
    public Guid NewId { get; set; }
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public bool IsActive { get; set; }
}

public class CoreMenuDto
{
    public int Id { get; set; }
    public Guid NewId { get; set; }
    public string Name { get; set; } = "";
    public Guid? ParentId { get; set; }
    public int? Seq { get; set; }
    public string Icon { get; set; } = "";
    public string Path { get; set; } = "";
    public bool IsVisible { get; set; }
    public bool IsActive { get; set; }
    public bool IsDevelopment { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTime? UpdatedDate { get; set; }
    public List<CoreMenuFunctionDto> FunctionBtn { get; set; } = new();
    public List<CoreMenuDto> SubMenu { get; set; } = new();
}

public record CreateCoreMenuRequest(string Name, Guid? ParentId, int? Seq, string? Icon, string? Path, bool IsVisible, bool IsActive, bool IsDevelopment, string CreatedBy);
public record UpdateCoreMenuRequest(string Name, Guid? ParentId, int? Seq, string? Icon, string? Path, bool IsVisible, bool IsActive, bool IsDevelopment, string UpdatedBy);
public record CreateCoreMenuComponentRequest(string Name, Guid MenuNewId, string? Path, string CreatedBy, bool IsActiveBtn);
public record UpdateRoleMenuAccessRequest(bool IsActive);
