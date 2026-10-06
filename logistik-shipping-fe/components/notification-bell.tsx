"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { listCoreNotifications, type CoreNotificationItem } from "@/lib/api/core-notification";
import { DateFormat, DateFormatRelativeHuman } from "@/utils/date-format";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [items, setItems] = React.useState<CoreNotificationItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const unreadCount = React.useMemo(() => items.filter((x) => !x.isRead).length, [items]);

  const load = React.useCallback(async () => {
    const token = getStoredAuthToken() ?? undefined;
    const user = getStoredAuthUser();
    const compcode = user?.site?.trim() || "";
    const userPrincipleName = user?.email?.trim() || user?.username?.trim() || "";
    if (!compcode) {
      setError("Compcode tidak ditemukan.");
      setItems([]);
      return;
    }
    if (!userPrincipleName) {
      setError("UserPrincipleName tidak ditemukan.");
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const rows = await listCoreNotifications({ compcode, userPrincipleName }, token);
      setItems(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengambil notifikasi.";
      setError(message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  React.useEffect(() => {
    function handleRefresh() {
      void load();
    }
    window.addEventListener("stage2:submitted", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("stage2:submitted", handleRefresh as EventListener);
    };
  }, [load]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Notifications</div>
              <div className="text-xs font-normal text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading notifications...</div>
        )}

        {!isLoading && error && (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications.</div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto px-2 py-2">
            {items.slice(0, 20).map((n) => (
              <DropdownMenuItem
                key={n.key}
                className="mb-2 flex cursor-pointer flex-col items-start rounded-xl border border-border/60 bg-background px-3 py-3 last:mb-0 focus:bg-accent/60"
                onSelect={() => {
                  if (n.redirectUrl) {
                    router.push(n.redirectUrl);
                    setOpen(false);
                  }
                }}
              >
                <div className="flex w-full items-start gap-3">
                  <div className="pt-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${n.isRead ? "bg-muted-foreground/30" : "bg-primary"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{n.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-medium text-foreground">{DateFormatRelativeHuman(n.createdDate)}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{DateFormat(n.createdDate)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
