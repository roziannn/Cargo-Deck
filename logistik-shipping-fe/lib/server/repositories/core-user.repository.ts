import { execute, query, withTransaction } from "@/lib/server/db";

export type CoreUserSearchRow = {
  username: string;
  email: string;
  name: string;
  site: string | null;
};

export type CoreUserRow = CoreUserSearchRow & {
  id: number;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type CoreUserInput = {
  username: string;
  email: string;
  name: string;
  site: string | null;
  isActive: boolean;
};

// password_hash is never selected
const COLUMNS = "id, username, email, name, site, is_active, created_by, created_date, updated_by, updated_date";

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

  getAll: () => query<CoreUserRow>(`SELECT ${COLUMNS} FROM core_user ORDER BY name`),

  async getById(id: number) {
    const rows = await query<CoreUserRow>(`SELECT ${COLUMNS} FROM core_user WHERE id = @id`, { id });
    return rows[0] ?? null;
  },

  async create(input: CoreUserInput & { password: string; createdBy: string }) {
    const rows = await query<CoreUserRow>(
      `INSERT INTO core_user (username, email, name, site, is_active, password_hash, created_by)
       VALUES (@username, @email, @name, @site, @isActive, crypt(@password, gen_salt('bf')), @createdBy)
       RETURNING ${COLUMNS}`,
      input,
    );
    return rows[0];
  },

  /**
   * Updates a user. A null `password` keeps the current one. Role claims reference the user by email,
   * so a changed email is carried over to core_role_claim in the same transaction.
   */
  update(id: number, previousEmail: string, input: CoreUserInput & { password: string | null; updatedBy: string }) {
    return withTransaction(async (tx) => {
      const rows = await query<CoreUserRow>(
        `UPDATE core_user
         SET username = @username, email = @email, name = @name, site = @site, is_active = @isActive,
             password_hash = CASE WHEN @password::text IS NULL THEN password_hash ELSE crypt(@password::text, gen_salt('bf')) END,
             updated_by = @updatedBy, updated_date = now()
         WHERE id = @id
         RETURNING ${COLUMNS}`,
        { ...input, id },
        tx,
      );
      if (rows.length === 0) return null;

      if (previousEmail.toLowerCase() !== input.email.toLowerCase()) {
        await execute(
          "UPDATE core_role_claim SET user_principal_name = @email, updated_by = @updatedBy, updated_date = now() WHERE user_principal_name = @previousEmail",
          { email: input.email, previousEmail, updatedBy: input.updatedBy },
          tx,
        );
      }
      return rows[0];
    });
  },
};
