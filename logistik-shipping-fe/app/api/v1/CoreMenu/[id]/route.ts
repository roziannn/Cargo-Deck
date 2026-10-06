import { NextResponse } from "next/server";
import { handle, noContent, readJson } from "@/lib/server/http";
import { coreMenuService } from "@/lib/server/services/core-menu.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET: menu tree with the access granted to role `id`. */
export const GET = (_req: Request, ctx: Ctx) => handle(async () => NextResponse.json(await coreMenuService.getByRole((await ctx.params).id)));

/** PUT: update menu `id`. */
export const PUT = (req: Request, ctx: Ctx) =>
  handle(async () => {
    await coreMenuService.update((await ctx.params).id, await readJson(req));
    return noContent();
  });
