import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstVehicleService } from "@/lib/server/services/mst-master.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await mstVehicleService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await mstVehicleService.create(await readJson(req))));
