"use client";

import * as React from "react";
import { ArrowLeftRight, FileSearch2, FileText, FolderOpen, LayoutDashboard, Settings, Sheet, type LucideIcon } from "lucide-react";

import { getStoredAuthToken, getStoredAuthUser, type AuthUserProfile } from "@/lib/api/auth";
import { listCoreMenusSidebar, type CoreMenuItem } from "@/lib/api/core-menu";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";

const defaultUser: AuthUserProfile = {
  name: "User",
  email: "user@dev.com",
  username: "user",
  avatar: "/avatars/shadcn.jpg",
};

type SidebarNavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isDevelopment?: boolean;
  items?: {
    title: string;
    url: string;
    isDevelopment?: boolean;
  }[];
};

const fallbackData: { navMain: SidebarNavItem[]; adminTools: SidebarNavItem[] } = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
  ],
  adminTools: [],
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickSidebarIcon(item: CoreMenuItem): LucideIcon {
  const nameKey = normalizeKey(item.name);
  const pathKey = normalizeKey(item.path);
  const iconKey = normalizeKey(item.icon);
  const combined = `${nameKey} ${pathKey} ${iconKey}`;

  if (combined.includes("dashboard")) return LayoutDashboard;
  if (combined.includes("audittrail")) return FileSearch2;
  if (combined.includes("transaction")) return ArrowLeftRight;
  if (combined.includes("validation")) return Sheet;
  if (combined.includes("setting")) return Settings;
  if (item.subMenu.length > 0) return FolderOpen;

  return FileText;
}

function mapSidebarItem(item: CoreMenuItem): SidebarNavItem | null {
  if (!item.isVisible) return null;

  const childItems = item.subMenu.map(mapSidebarItem).filter((value): value is SidebarNavItem => Boolean(value));
  const title = item.name.trim() || "Untitled";
  const url = item.path?.trim() || "#";

  if (!title) return null;

  return {
    title,
    url,
    icon: pickSidebarIcon(item),
    isDevelopment: item.isDevelopment,
    items:
      childItems.length > 0
        ? childItems.map((child) => ({
            title: child.title,
            url: child.url,
            isDevelopment: child.isDevelopment,
          }))
        : undefined,
  };
}

function isAdminItem(item: SidebarNavItem) {
  const current = item.url.toLowerCase();
  const childPaths = item.items?.map((child) => child.url.toLowerCase()) ?? [];
  return current.startsWith("/settings") || item.title.trim().toLowerCase() === "settings" || childPaths.some((path) => path.startsWith("/settings"));
}

function buildSidebarData(items: CoreMenuItem[]) {
  const mappedItems = items.map(mapSidebarItem).filter((value): value is SidebarNavItem => Boolean(value));

  const navMain = mappedItems.filter((item) => !isAdminItem(item));
  const adminTools = mappedItems.filter(isAdminItem);

  return {
    navMain: navMain.length > 0 ? navMain : fallbackData.navMain,
    adminTools,
  };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<AuthUserProfile>(defaultUser);
  const [mounted, setMounted] = React.useState(false);
  const [menuData, setMenuData] = React.useState(fallbackData);

  React.useEffect(() => {
    const storedUser = getStoredAuthUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadSidebar() {
      const storedUser = getStoredAuthUser();
      const token = getStoredAuthToken() ?? undefined;
      const userPrincipalName = storedUser?.email?.trim() || storedUser?.username?.trim();
      if (!userPrincipalName) {
        if (!cancelled) setMenuData(fallbackData);
        return;
      }

      try {
        const result = await listCoreMenusSidebar(userPrincipalName, token);
        if (!cancelled) {
          setMenuData(buildSidebarData(result));
        }
      } catch (error) {
        console.error("Failed to load sidebar menus", error);
        if (!cancelled) {
          setMenuData(fallbackData);
        }
      }
    }

    void loadSidebar();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {mounted ? (
          <>
            <NavMain items={menuData.navMain} label="Navigation" />
            {menuData.adminTools.length > 0 ? <NavMain items={menuData.adminTools} label="Admin Tools" /> : null}
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        {mounted ? <NavUser user={user} /> : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
