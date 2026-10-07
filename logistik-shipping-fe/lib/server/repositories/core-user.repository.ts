import { query } from "@/lib/server/db";

export type CoreUserSearchRow = {
  username: string;
  email: string;
  name: string;
  site: string | null;
};

export const coreUserRepository = {
  /** Active users whose name, username or email contains `keyword` (case-insensitive, no wildcards). */
  search: (keyword: string, limit: number) =>
    query<CoreUserSearchRow>(
      `SELECT username, email, name, site FROM core_user
       WHERE is_active = true
         AND (position(lower(@keyword) in lower(name)) > 0
           OR position(lower(@keyword) in lower(username)) > 0
           OR position(lower(@keyword) in lower(email)) > 0)
       ORDER BY name
       LIMIT @limit`,
      { keyword, limit },
    ),
};
