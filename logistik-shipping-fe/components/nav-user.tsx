"use client";

import * as React from "react";
import { ChevronsUpDown, LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { clearAuthSession, getStoredAuthToken, notifyLogout } from "@/lib/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{value || "-"}</div>
    </div>
  );
}

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    username?: string;
    nik?: string;
    jobLvlName?: string;
    jobTtlName?: string;
    compName?: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { t } = useI18n();
  const [openProfile, setOpenProfile] = React.useState(false);
  const displayName = React.useMemo(() => {
    const normalizedName = user.name.trim();
    if (normalizedName && !normalizedName.includes("@")) {
      return normalizedName;
    }

    const fallbackSource = user.username?.trim() || user.email.trim();
    const localPart = fallbackSource.split("@")[0] ?? fallbackSource;
    const words = localPart
      .split(/[._-]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (words.length === 0) return "User";

    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }, [user.email, user.name, user.username]);
  const initials = React.useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "US";
  }, [displayName]);

  async function handleLogout() {
    await notifyLogout(getStoredAuthToken() ?? undefined);
    clearAuthSession();
    router.push("/login");
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={displayName} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setOpenProfile(true)}>
                  <UserCircle />
                  {t("Profile")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut />
                {t("Log out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Profile")}</DialogTitle>
            <DialogDescription>{t("Account information for the current logged-in user.")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 rounded-lg">
                <AvatarImage src={user.avatar} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="grid gap-3">
              <ProfileField label={t("Name")} value={user.name?.trim() || displayName} />
              <ProfileField label="Email" value={user.email} />
              <ProfileField label={t("Company Name")} value={user.compName?.trim() || "-"} />
              <ProfileField label={t("Job Title")} value={user.jobTtlName?.trim() || "-"} />
              <ProfileField label="NIK" value={user.nik?.trim() || user.username?.trim() || "-"} />
            </div>
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
