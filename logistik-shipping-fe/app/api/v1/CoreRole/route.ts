import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { coreRoleService } from "@/lib/server/services/core-role.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await coreRoleService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await coreRoleService.create(await readJson(req))));
