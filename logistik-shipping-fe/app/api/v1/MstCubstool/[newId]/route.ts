import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstCubstoolService } from "@/lib/server/services/mst-master.service";

export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await mstCubstoolService.update((await ctx.params).newId, await readJson(req))));
