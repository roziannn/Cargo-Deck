import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Books carrier, driver and plate for an approved plan (also used to change an existing booking). */
export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.saveBooking((await ctx.params).newId, await readJson(req))));
