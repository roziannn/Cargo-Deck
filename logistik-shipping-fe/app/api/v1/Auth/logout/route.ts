import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/server/audit";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** The token is stateless, so logging out only records the event; the client drops its token. */
export const POST = () =>
  handle(async () => {
    await writeAudit({ module: "Auth", action: "LOGOUT", note: "Keluar dari aplikasi" });
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  });
