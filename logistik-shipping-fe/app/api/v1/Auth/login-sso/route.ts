import { NextResponse } from "next/server";
import { signToken } from "@/lib/server/auth";
import { writeAudit } from "@/lib/server/audit";
import { query } from "@/lib/server/db";
import { HttpError, handle, readJson, requireString } from "@/lib/server/http";

type UserRow = { username: string; email: string; name: string; site: string | null };

export const POST = (req: Request) =>
  handle(
    async () => {
      const body = await readJson(req);
      const username = requireString(body.username, "username");
      const password = requireString(body.password, "password");
      const site = typeof body.site === "string" ? body.site.trim() : "";

      // Password is checked in SQL with pgcrypto (bcrypt), so the hash never leaves the database.
      const rows = await query<UserRow>(
        `SELECT username, email, name, site FROM core_user
         WHERE is_active = true
           AND (lower(username) = lower(@username) OR lower(email) = lower(@username))
           AND password_hash = crypt(@password, password_hash)`,
        { username, password },
      );
      const user = rows[0];
      if (!user) {
        // the typed username is not trusted as an identity: it is kept in the note only
        await writeAudit({
          module: "Auth",
          action: "LOGIN_FAILED",
          actor: { username: null, name: null },
          note: `Gagal login ke aplikasi dengan username '${username.slice(0, 100)}': username atau password salah`,
        });
        throw new HttpError(401, "Username atau password salah.");
      }

      const profile = { username: user.username, email: user.email, name: user.name, site: site || user.site || "" };
      await writeAudit({ module: "Auth", action: "LOGIN_SUCCESS", actor: { username: user.username, name: user.name, email: user.email }, note: "Berhasil login ke aplikasi" });
      return NextResponse.json({ token: signToken(profile), user: profile });
    },
    { isPublic: true },
  );
