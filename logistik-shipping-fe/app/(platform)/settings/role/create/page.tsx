"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { createCoreRole } from "@/lib/api/core-role";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toaster, toast } from "react-hot-toast";

function formatDateTime(value: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });

  return formatter.format(value).replace(" ", " ");
}

export default function RoleCreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const createdDate = useMemo(() => formatDateTime(new Date()), []);
  const [actor, setActor] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const currentUser = getStoredAuthUser();
    setActor((currentUser?.name || currentUser?.username || currentUser?.email || "").trim());
  }, []);

  async function handleSave() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      toast.error(t("Name wajib diisi."));
      return;
    }

    if (!actor) {
      toast.error(t("User login tidak ditemukan."));
      return;
    }

    setIsSaving(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      await createCoreRole(
        {
          name: normalizedName,
          isActive,
          createdBy: actor,
        },
        token,
      );

      toast.success(t('Role "{name}" berhasil disimpan.', { name: normalizedName }));
      router.push("/settings/role");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Gagal menyimpan role.");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Add Role")}</h1>
        <p className="text-sm text-muted-foreground">{t("Create a new core role with the field structure based on the master table.")}</p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role-name">{t("Name")}</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Input role name")} maxLength={256} />
          </div>

          <div className="space-y-2">
            <Label>{t("Is Active")}</Label>
            <div className="flex h-10 items-center justify-between rounded-md border px-3">
              <span className="text-sm text-muted-foreground">{isActive ? t("Active") : t("Inactive")}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="created-by">{t("Created By")}</Label>
            <Input id="created-by" value={actor} readOnly disabled placeholder={t("Auto from login user")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="created-date">{t("Created Date")}</Label>
            <Input id="created-date" value={createdDate} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="updated-by">{t("Updated By")}</Label>
            <Input id="updated-by" value="" readOnly disabled placeholder={t("Filled automatically on update")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="updated-date">{t("Updated Date")}</Label>
            <Input id="updated-date" value="" readOnly disabled placeholder={t("Filled automatically on update")} />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button asChild variant="outline" disabled={isSaving}>
            <Link href="/settings/role">{t("Cancel")}</Link>
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? t("Saving...") : t("Save Role")}
          </Button>
        </div>
      </div>
    </div>
  );
}
