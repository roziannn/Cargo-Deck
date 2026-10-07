import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ newId: string }> };

export const GET = (_req: Request, ctx: Ctx) => handle(async () => NextResponse.json(await shippingPlanService.getDetail((await ctx.params).newId)));

export const PUT = (req: Request, ctx: Ctx) =>
  handle(async () => NextResponse.json(await shippingPlanService.updateHeader((await ctx.params).newId, await readJson(req))));
