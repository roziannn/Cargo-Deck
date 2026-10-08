import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { auditTrailService } from "@/lib/server/services/audit-trail.service";

export const dynamic = "force-dynamic";

/** Audit trail entries, newest first. Query: from, to (YYYY-MM-DD), q, module, activity, user, page, pageSize. */
export const GET = (req: Request) => handle(async () => NextResponse.json(await auditTrailService.list(new URL(req.url).searchParams)));
