import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { coreRoleClaimService } from "@/lib/server/services/core-role.service";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, ctx: { params: Promise<{ roleId: string }> }) =>
  handle(async () => NextResponse.json(await coreRoleClaimService.getByRoleId((await ctx.params).roleId)));
