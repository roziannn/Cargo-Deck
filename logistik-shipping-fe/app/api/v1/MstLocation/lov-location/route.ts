import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { mstLocationService } from "@/lib/server/services/shipping-plan.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await mstLocationService.getLov()));
