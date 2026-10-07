import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/server/http";
import { coreUserService } from "@/lib/server/services/core-user.service";

/** Body is the full user; `password` is optional and only changes the password when it is not empty. */
export const PUT = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => NextResponse.json(await coreUserService.update(Number((await ctx.params).id), await readJson(req))));
