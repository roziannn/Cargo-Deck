import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

export const dynamic = "force-dynamic";

export const GET = (_req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.getDeliveryNote((await ctx.params).newId)));
