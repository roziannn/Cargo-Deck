import { NextResponse } from "next/server";
import { handle, optNumber } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

export const dynamic = "force-dynamic";

/** Freight cost estimate. Optional query: distanceKm (manual distance), loadingFee, otherFee. */
export const GET = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => {
    const params = new URL(req.url).searchParams;
    const fee = (name: string) => Math.max(0, Math.round(optNumber(params.get(name), name) ?? 0));
    return NextResponse.json(
      await shippingPlanService.estimate((await ctx.params).newId, {
        distanceKm: optNumber(params.get("distanceKm"), "distanceKm"),
        loadingFee: fee("loadingFee"),
        otherFee: fee("otherFee"),
      }),
    );
  });
