import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { mstVehicleService } from "@/lib/server/services/mst-master.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await mstVehicleService.getLov()));
