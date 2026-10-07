import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { dashboardService } from "@/lib/server/services/dashboard.service";

export const dynamic = "force-dynamic";

/** Dashboard figures for the last `range` days (7, 30, 90 or 365; default 30). */
export const GET = (req: Request) => handle(async () => NextResponse.json(await dashboardService.get(new URL(req.url).searchParams.get("range") ?? undefined)));
