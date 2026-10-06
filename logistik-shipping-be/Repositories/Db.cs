using System.Data;
using Microsoft.Data.SqlClient;

namespace LogistikShipping.Api.Repositories;

public interface IDbConnectionFactory
{
    IDbConnection Create();
}

public class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:Default");
    }

    public IDbConnection Create() => new SqlConnection(_connectionString);
}
