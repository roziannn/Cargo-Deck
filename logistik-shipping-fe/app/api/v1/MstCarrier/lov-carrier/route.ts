import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { mstCarrierService } from "@/lib/server/services/mst-logistics.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await mstCarrierService.getLov()));
