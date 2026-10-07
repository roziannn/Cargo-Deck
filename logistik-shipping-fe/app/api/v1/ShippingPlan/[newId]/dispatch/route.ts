import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/** Issues the surat jalan number and marks the plan as dispatched. Optional body: `{ etaDate, graceDays }`. */
export const POST = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await shippingPlanService.dispatch((await ctx.params).newId, body && typeof body === "object" && !Array.isArray(body) ? body : {}));
  });
