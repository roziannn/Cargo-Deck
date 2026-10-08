import { NextResponse } from "next/server";
import { currentUser, handle } from "@/lib/server/http";
import { getAccess } from "@/lib/server/permissions";

export const dynamic = "force-dynamic";

/** The signed-in user and the menus they may open (fresh from the database, unlike the list stored at login). */
export const GET = () =>
  handle(async () => {
    const user = await currentUser();
    const access = await getAccess(user.email);
    return NextResponse.json({
      username: user.preferred_username,
      name: user.name,
      email: user.email,
      isAdmin: access.isAdmin,
      menus: access.paths,
      home: access.paths[0] ?? "/forbidden",
    });
  });
