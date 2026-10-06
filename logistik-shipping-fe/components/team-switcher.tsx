"use client";

import * as React from "react";
import { Truck } from "lucide-react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import Image from "next/image";

export function TeamSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
          <div className="flex items-center gap-1.5 w-full">
            <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center shadow-sm shrink-0">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>

            <div className="h-8 w-px bg-border/80" />

            <Image src="/logo/site_logo.png" alt="Site Logo" width={64} height={40} className="object-contain" priority />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
