import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { coreRoleClaimService } from "@/lib/server/services/core-role.service";

export const POST = (req: Request) => handle(async () => NextResponse.json(await coreRoleClaimService.add(await readJson(req))));
