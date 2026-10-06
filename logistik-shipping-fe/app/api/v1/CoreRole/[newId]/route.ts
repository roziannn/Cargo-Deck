import { handle, noContent, readJson } from "@/lib/server/http";
import { coreRoleService } from "@/lib/server/services/core-role.service";

export const PUT = (req: Request, ctx: { params: Promise<{ newId: string }> }) =>
  handle(async () => {
    const { newId } = await ctx.params;
    await coreRoleService.update(newId, await readJson(req));
    return noContent();
  });
