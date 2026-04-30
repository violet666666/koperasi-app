"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Info,
  Package,
  ShoppingCart,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
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

const typeLabels: Record<string, string> = {
  low_stock: "Stok Rendah",
  expiring_soon: "Hampir Expired",
  batch_expired: "Batch Expired",
  stock_in: "Stok Masuk",
  void_request: "Void Request",
  info: "Info",
};

const typeBadgeVariants: Record<string, string> = {
  low_stock: "bg-orange-100 text-orange-700",
  expiring_soon: "bg-yellow-100 text-yellow-700",
  batch_expired: "bg-red-100 text-red-700",
  stock_in: "bg-blue-100 text-blue-700",
  void_request: "bg-purple-100 text-purple-700",
  info: "bg-gray-100 text-gray-700",
};

const typeIconColors: Record<string, string> = {
  low_stock: "text-orange-500",
  expiring_soon: "text-yellow-500",
  batch_expired: "text-red-500",
  stock_in: "text-blue-500",
  void_request: "text-purple-500",
  info: "text-gray-500",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotifikasiPage() {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterType !== "all") params.set("type", filterType);
      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setTotal(json.total || 0);
        setUnreadCount(json.unreadCount || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  React.useEffect(() => {
    fetchNotifications();
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
      // Silently fail
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
      // Silently fail
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === id);
          if (deleted && !deleted.isRead) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
          return prev.filter((n) => n.id !== id);
        });
        setTotal((prev) => prev - 1);
      }
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} notifikasi belum dibaca`
              : "Semua notifikasi sudah dibaca"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(val) => { setFilterType(val); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="low_stock">Stok Rendah</SelectItem>
              <SelectItem value="stock_in">Stok Masuk</SelectItem>
              <SelectItem value="void_request">Void Request</SelectItem>
              <SelectItem value="expiring_soon">Hampir Expired</SelectItem>
              <SelectItem value="batch_expired">Batch Expired</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-1" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Memuat notifikasi...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            Tidak ada notifikasi
          </div>
        ) : (
          <>
            {notifications.map((n, i) => {
              const Icon = typeIcons[n.type] || Info;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/30",
                    !n.isRead && "bg-primary/5",
                    i < notifications.length - 1 && "border-b"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn("h-5 w-5", typeIconColors[n.type] || "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm", !n.isRead && "font-semibold")}>
                        {n.title}
                      </p>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", typeBadgeVariants[n.type] || "bg-gray-100 text-gray-700")}>
                        {typeLabels[n.type] || n.type}
                      </span>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markAsRead(n.id)} title="Tandai dibaca">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteNotification(n.id)} title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages} ({total} notifikasi)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
