import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstVehicleService } from "@/lib/server/services/mst-master.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ newId: string }> };

export const GET = (_req: Request, ctx: Ctx) => handle(async () => NextResponse.json(await mstVehicleService.getByNewId((await ctx.params).newId)));

export const PUT = (req: Request, ctx: Ctx) =>
  handle(async () => NextResponse.json(await mstVehicleService.update((await ctx.params).newId, await readJson(req))));
