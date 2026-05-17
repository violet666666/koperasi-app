"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, Package, AlertTriangle, Info, XCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, React.ElementType> = {
  low_stock: AlertTriangle,
  expiring_soon: AlertTriangle,
  batch_expired: XCircle,
  stock_in: Package,
  void_request: ShoppingCart,
  info: Info,
};

const typeColors: Record<string, string> = {
  low_stock: "text-orange-500",
  expiring_soon: "text-yellow-500",
  batch_expired: "text-red-500",
  stock_in: "text-blue-500",
  void_request: "text-purple-500",
  info: "text-muted-foreground",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  const fetchNotifications = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/notifications?limit=10", { signal });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount || 0);
      }
    } catch (error) {
      // Silently ignore AbortError and network errors (common during dev hot-reload)
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof TypeError && error.message === "Failed to fetch") return;
    }
  }, []);

  // Poll every 30s
  React.useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    const interval = setInterval(() => fetchNotifications(controller.signal), 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silently ignore network errors (dev hot-reload, offline)
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/read", { method: "PUT" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // Silently ignore network errors
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifikasi</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifikasi</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground" onClick={markAllRead}>
              Tandai semua dibaca
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Tidak ada notifikasi
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcons[n.type] || Info;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    !n.isRead && "bg-muted/30"
                  )}
                  onClick={() => !n.isRead && markAsRead(n.id)}
                >
                  <div className={cn("mt-0.5 shrink-0", typeColors[n.type] || "text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.isRead && "font-medium")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Link
            href="/notifikasi"
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Lihat semua notifikasi
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
