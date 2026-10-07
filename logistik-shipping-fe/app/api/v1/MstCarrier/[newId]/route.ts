import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstCarrierService } from "@/lib/server/services/mst-logistics.service";

export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await mstCarrierService.update((await ctx.params).newId, await readJson(req))));
