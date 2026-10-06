using Asp.Versioning;
using LogistikShipping.Api.Repositories;
using LogistikShipping.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddApiVersioning(o => o.DefaultApiVersion = new ApiVersion(1, 0)).AddMvc();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

builder.Services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<ICoreRoleRepository, CoreRoleRepository>();
builder.Services.AddScoped<ICoreRoleClaimRepository, CoreRoleClaimRepository>();
builder.Services.AddScoped<ICoreMenuRepository, CoreMenuRepository>();
builder.Services.AddScoped<ICoreRoleService, CoreRoleService>();
builder.Services.AddScoped<ICoreRoleClaimService, CoreRoleClaimService>();
builder.Services.AddScoped<ICoreMenuService, CoreMenuService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (ArgumentException ex) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { message = ex.Message }); }
    catch (KeyNotFoundException ex) { ctx.Response.StatusCode = 404; await ctx.Response.WriteAsJsonAsync(new { message = ex.Message }); }
});

app.UseCors();
app.MapControllers();
app.Run();
