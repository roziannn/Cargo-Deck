import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Body: { items: [{ cubstoolNewId, pickedQty }], notes?, complete? }. `complete: true` moves the plan to LOADING. */
export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.savePicking((await ctx.params).newId, await readJson(req))));
