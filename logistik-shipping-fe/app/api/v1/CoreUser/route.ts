import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { coreUserService } from "@/lib/server/services/core-user.service";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => NextResponse.json(await coreUserService.getAll()));

export const POST = (req: Request) => handle(async () => NextResponse.json(await coreUserService.create(await readJson(req))));
