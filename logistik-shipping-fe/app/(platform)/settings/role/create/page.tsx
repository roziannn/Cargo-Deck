"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { createCoreRole } from "@/lib/api/core-role";
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
      toast.error("Name wajib diisi.");
      return;
    }

    if (!actor) {
      toast.error("User login tidak ditemukan.");
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

      toast.success(`Role "${normalizedName}" berhasil disimpan.`);
      router.push("/settings/role");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan role.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Add Role</h1>
        <p className="text-sm text-muted-foreground">Create a new core role with the field structure based on the master table.</p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Input role name" maxLength={256} />
          </div>

          <div className="space-y-2">
            <Label>Is Active</Label>
            <div className="flex h-10 items-center justify-between rounded-md border px-3">
              <span className="text-sm text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="created-by">Created By</Label>
            <Input id="created-by" value={actor} readOnly disabled placeholder="Auto from login user" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="created-date">Created Date</Label>
            <Input id="created-date" value={createdDate} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="updated-by">Updated By</Label>
            <Input id="updated-by" value="" readOnly disabled placeholder="Filled automatically on update" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="updated-date">Updated Date</Label>
            <Input id="updated-date" value="" readOnly disabled placeholder="Filled automatically on update" />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button asChild variant="outline" disabled={isSaving}>
            <Link href="/settings/role">Cancel</Link>
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Role"}
          </Button>
        </div>
      </div>
    </div>
  );
}
