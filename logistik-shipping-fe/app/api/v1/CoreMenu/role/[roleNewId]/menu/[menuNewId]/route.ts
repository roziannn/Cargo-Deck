import { handle, noContent, readJson } from "@/lib/server/http";
import { coreMenuService } from "@/lib/server/services/core-menu.service";

export const PUT = (req: Request, ctx: { params: Promise<{ roleNewId: string; menuNewId: string }> }) =>
  handle(async () => {
    const { roleNewId, menuNewId } = await ctx.params;
    await coreMenuService.setMenuAccess(roleNewId, menuNewId, await readJson(req));
    return noContent();
  });
