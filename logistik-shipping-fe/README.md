This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API (.NET Backend)

### Frontend Setup

1. Copy env file:

```bash
copy .env.example .env.local
```

2. Set your backend base URL in `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://localhost:7143
NEXT_PUBLIC_API_VERSION=1
NEXT_PUBLIC_API_CREDENTIALS=include
```

3. Use the API helper:

```ts
import { apiFetch } from "@/lib/api-client";

type ProductDto = {
  id: number;
  itemCode: string;
  productName: string;
  line: string;
  isActive: boolean;
};

export async function listProducts() {
  return apiFetch<ProductDto[]>("/api/products", { method: "GET" });
}
```

### Login SSO Endpoint

If your backend login endpoint is `/api/v{version}/Auth/login-sso`, use the helper in [auth.ts](lib/api/auth.ts):

```ts
import { loginSso } from "@/lib/api/auth";

await loginSso(
  { username: "user", password: "pass", site: "DKF" },
  { version: "1" },
);
```

### .NET Backend Setup (CORS)

If you call the API directly from the browser, you must enable CORS on your ASP.NET Core API.

`Program.cs` example:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:3000", "https://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // if using cookie-based auth
    });
});

builder.Services.AddControllers();
var app = builder.Build();

app.UseCors("Frontend");
app.MapControllers();
app.Run();
```

If you use cookies for auth, also add `.AllowCredentials()` and configure cookie SameSite/HTTPS properly.

### Dev HTTPS Certificate (Localhost)

If your API runs on `https://localhost:7143`, make sure your dev certificate is trusted:

```bash
dotnet dev-certs https --trust
```

If using cookies for SSO, ensure your auth cookie uses:
- `SameSite=None`
- `Secure=true`
- Set from your API domain (`localhost`) so the browser accepts it.

## Core access API (Role, RoleClaim, Menu, MenuFunction, RoleMenu)

Served by Next.js route handlers under `app/api/v1/*` (no separate backend). Layers:
`app/api/v1/**/route.ts` → `lib/server/services` → `lib/server/repositories` → PostgreSQL (`lib/server/db.ts`, `pg`).

1. Run `../database/001_create_core_access_tables.sql` on your PostgreSQL database.
2. In `.env.local` set:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/logistik_shipping"
   NEXT_PUBLIC_API_BASE_URL=   # leave empty to call the built-in route handlers (same origin)
   ```
