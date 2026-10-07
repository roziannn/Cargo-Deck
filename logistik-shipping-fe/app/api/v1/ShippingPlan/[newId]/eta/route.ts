import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Changes ETA and grace days of a dispatched plan. */
export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.updateEta((await ctx.params).newId, await readJson(req))));
