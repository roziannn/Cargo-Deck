import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Saves the load simulation (vehicle + items + utilization) onto the plan. */
export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.saveLoad((await ctx.params).newId, await readJson(req))));
