import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { auditTrailService } from "@/lib/server/services/audit-trail.service";

export const dynamic = "force-dynamic";

/** The modules, activities and users that appear in the audit trail, for the filter dropdowns. */
export const GET = () => handle(async () => NextResponse.json(await auditTrailService.facets()));
