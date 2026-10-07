import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Issues the surat jalan number and marks the plan as dispatched. */
export const POST = (_req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.dispatch((await ctx.params).newId)));
