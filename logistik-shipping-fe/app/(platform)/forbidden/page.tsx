"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { apiFetch, apiPath } from "@/lib/api-client";
import { getStoredAuthToken } from "@/lib/api/auth";

type Me = { name: string; menus: string[]; home: string };

export default function ForbiddenPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>(apiPath("Auth/me"), { method: "GET", token: getStoredAuthToken() ?? undefined, cache: "no-store" })
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const hasMenus = (me?.menus.length ?? 0) > 0;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-amber-500" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("Anda tidak memiliki akses")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {hasMenus
          ? t("Akun Anda belum diberi akses ke halaman ini. Hubungi administrator kalau Anda membutuhkannya.")
          : t("Akun Anda belum memiliki akses ke menu apa pun. Hubungi administrator untuk dimasukkan ke sebuah role.")}
      </p>
      {hasMenus && me && (
        <Button asChild>
          <Link href={me.home}>{t("Kembali ke halaman utama")}</Link>
        </Button>
      )}
    </div>
  );
}
