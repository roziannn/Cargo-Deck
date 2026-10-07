import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { shippingIncidentService } from "@/lib/server/services/shipping-incident.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await shippingIncidentService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await shippingIncidentService.create(await readJson(req))));
