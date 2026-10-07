import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstDriverService } from "@/lib/server/services/mst-logistics.service";

export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await mstDriverService.update((await ctx.params).newId, await readJson(req))));
