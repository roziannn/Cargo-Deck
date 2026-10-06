"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DarkModeToggle } from "@/components/darkmode-toggle";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const NotificationBell = dynamic(() => import("@/components/notification-bell").then((m) => m.NotificationBell), { ssr: false });

function titleCaseFromSegment(segment: string) {
  return segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const segments = React.useMemo(() => {
    if (!pathname) return [];
    return pathname.split("/").filter(Boolean);
  }, [pathname]);

  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    return {
      label: titleCaseFromSegment(segment),
      href,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center justify-between bg-background px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((item, idx) => (
                  <React.Fragment key={item.href}>
                    <BreadcrumbItem className="hidden md:block">{item.isLast ? <BreadcrumbPage>{item.label}</BreadcrumbPage> : <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>}</BreadcrumbItem>

                    {idx < breadcrumbs.length - 1 && <BreadcrumbSeparator className="hidden md:block" />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <DarkModeToggle />
          </div>
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 pt-0">{children}</main>
        <footer className="border-t border-border/70 bg-background px-4 py-5 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Logistics Shipping System.</p>
            <div className="flex items-center gap-2 text-left sm:text-right">
              <p className="text-foreground">Version 1.0.0</p>
              <p>Made with ❤️ for Logistics Team</p>
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
