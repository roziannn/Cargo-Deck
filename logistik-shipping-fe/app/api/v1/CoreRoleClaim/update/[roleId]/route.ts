import { handle, noContent, readJson } from "@/lib/server/http";
import { coreRoleClaimService } from "@/lib/server/services/core-role.service";

export const PUT = (req: Request, ctx: { params: Promise<{ roleId: string }> }) =>
  handle(async () => {
    const { roleId } = await ctx.params;
    await coreRoleClaimService.update(roleId, await readJson(req));
    return noContent();
  });
