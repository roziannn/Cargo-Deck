import { handle, noContent, readJson } from "@/lib/server/http";
import { coreMenuService } from "@/lib/server/services/core-menu.service";

export const PUT = (req: Request, ctx: { params: Promise<{ roleNewId: string; functionNewId: string }> }) =>
  handle(async () => {
    const { roleNewId, functionNewId } = await ctx.params;
    await coreMenuService.setFunctionAccess(roleNewId, functionNewId, await readJson(req));
    return noContent();
  });
