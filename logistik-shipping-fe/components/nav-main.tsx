"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";

export function NavMain({
  items,
  label = "Navigation",
}: {
  label?: string;
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isDevelopment?: boolean;
    items?: {
      title: string;
      url: string;
      isDevelopment?: boolean;
    }[];
  }[];
}) {
  const pathname = usePathname();

  const DevBadge = () => (
    <div className="ml-auto flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 dark:bg-sky-400/80"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.9)] dark:bg-sky-400 dark:shadow-[0_0_10px_rgba(56,189,248,0.85)]"></span>
      </div>
      <span className="rounded border border-blue-200/70 bg-blue-50/70 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-200">
        On Dev
      </span>
    </div>
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>

      <SidebarMenu>
        {items.map((item) => {
          const hasSubmenu = Array.isArray(item.items) && item.items.length > 0;
          const isItemActive = pathname === item.url || item.items?.some((sub) => pathname.startsWith(sub.url));

          if (!hasSubmenu) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isItemActive} tooltip={item.title}>
                  <Link href={item.url} className="flex items-center w-full">
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span>{item.title}</span>
                    {item.isDevelopment && <DevBadge />}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible key={item.title} asChild defaultOpen={isItemActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={isItemActive}>
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span>{item.title}</span>
                    {item.isDevelopment ? <DevBadge /> : null}
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isSubActive = pathname === subItem.url || pathname.startsWith(subItem.url);

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isSubActive}>
                            <Link href={subItem.url} className="flex w-full items-center">
                              <span>{subItem.title}</span>
                              {subItem.isDevelopment ? <DevBadge /> : null}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
