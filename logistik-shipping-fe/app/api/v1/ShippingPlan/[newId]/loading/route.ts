import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

/**
 * Body: { items: [{ cubstoolNewId, loadedQty }], checklist: { vehiclePapers, vehicleClean, vehicleCondition, driverReady, cargoSecured },
 *         loadingTempC?, sealNo?, grossWeightKg?, tareWeightKg?, notes? }
 */
export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => NextResponse.json(await shippingPlanService.saveLoading((await ctx.params).newId, await readJson(req))));
