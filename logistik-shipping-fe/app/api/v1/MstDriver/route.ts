import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { mstDriverService } from "@/lib/server/services/mst-logistics.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await mstDriverService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await mstDriverService.create(await readJson(req))));
