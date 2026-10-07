import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Marks a dispatched plan as received (COMPLETED). */
export const POST = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.receive((await ctx.params).newId, await readJson(req))));
