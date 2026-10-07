import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstLocationService } from "@/lib/server/services/shipping-plan.service";

export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await mstLocationService.update((await ctx.params).newId, await readJson(req))));
