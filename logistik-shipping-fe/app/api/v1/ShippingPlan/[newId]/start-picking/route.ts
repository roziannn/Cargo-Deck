import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** BOOKED -> PICKING. */
export const POST = (_req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.startPicking((await ctx.params).newId)));
