import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { coreMenuService } from "@/lib/server/services/core-menu.service";

export const POST = (req: Request) => handle(async () => NextResponse.json(await coreMenuService.create(await readJson(req))));
