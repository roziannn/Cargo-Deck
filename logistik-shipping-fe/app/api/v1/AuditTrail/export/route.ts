import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { auditTrailService } from "@/lib/server/services/audit-trail.service";

export const dynamic = "force-dynamic";

/** Every entry of a period (oldest first) for the downloadable report. Query: from, to, format (pdf|xlsx) and the same filters as the list. */
export const GET = (req: Request) => handle(async () => NextResponse.json(await auditTrailService.export(new URL(req.url).searchParams)));
