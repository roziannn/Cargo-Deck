import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { coreUserRepository } from "@/lib/server/repositories/core-user.repository";

export const dynamic = "force-dynamic";

/**
 * Employee lookup used when adding a user to a role. It used to be served by the HRIS service;
 * now it searches the local core_user table. Query: ?search=...&limit=20
 */
export const GET = (req: Request) =>
  handle(async () => {
    const params = new URL(req.url).searchParams;
    const keyword = (params.get("search") ?? "").trim();
    const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
    if (!keyword) return NextResponse.json([]);

    const users = await coreUserRepository.search(keyword, limit);
    return NextResponse.json(
      users.map((u) => ({
        id: u.email,
        name: u.name,
        email: u.email,
        employeeId: u.username,
        role: u.site || "-",
      })),
    );
  });
