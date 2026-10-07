import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingPlanService } from "@/lib/server/services/shipping-plan.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await shippingPlanService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await shippingPlanService.create(await readJson(req))));
