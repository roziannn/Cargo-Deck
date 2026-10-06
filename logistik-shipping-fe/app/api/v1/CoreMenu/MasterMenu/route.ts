import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { coreMenuService } from "@/lib/server/services/core-menu.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await coreMenuService.getMaster()));
