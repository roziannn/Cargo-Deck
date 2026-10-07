import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingIncidentService } from "@/lib/server/services/shipping-incident.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ newId: string }> };

export const GET = (_req: Request, ctx: Ctx) => handle(async () => NextResponse.json(await shippingIncidentService.getByNewId((await ctx.params).newId)));

export const PUT = (req: Request, ctx: Ctx) =>
  handle(async () => NextResponse.json(await shippingIncidentService.update((await ctx.params).newId, await readJson(req))));
