"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { bottomNavigation, filterNavigationByPermissions } from "@/lib/constants/navigation";
import { useAuth } from "@/lib/hooks";
import { MoreHorizontal } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { mainNavigation, isNavGroup } from "@/lib/constants/navigation";

export function BottomNav() {
    const pathname = usePathname();
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);
    const [pendingCount, setPendingCount] = React.useState(0);
    const { user } = useAuth();
    const userPermissions = user?.permissions || [];
    const filteredMainNav = filterNavigationByPermissions(mainNavigation, userPermissions);

    // Fetch pending approval count for badge
    React.useEffect(() => {
        const fetchPending = async () => {
            try {
                const res = await fetch("/api/approvals?status=pending");
                if (res.ok) {
                    const json = await res.json();
                    setPendingCount(json.pendingCount || 0);
                }
            } catch { /* silent fail */ }
        };
        fetchPending();
        const interval = setInterval(fetchPending, 60000); // Poll setiap 1 menit
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div className="h-20 lg:hidden print:hidden" aria-hidden="true" /> {/* Spacer for scroll safely (h-16 + 16px safe calc) */}
            <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden print:hidden" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
                <div className="flex h-16 items-center justify-around px-2">
                    {bottomNavigation
                        .filter(item => {
                            if (!item.permission) return true; // Dashboard selalu tampil
                            return userPermissions.includes(item.permission);
                        })
                        .map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);
                        const isApproval = item.href === "/approval";
                        const showBadge = isApproval && pendingCount > 0;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors relative",
                                    isActive
                                        ? "text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span className="relative">
                                    {Icon && (
                                        <Icon
                                            className={cn("h-5 w-5", isActive && "text-primary")}
                                        />
                                    )}
                                    {showBadge && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                            {pendingCount > 9 ? "9+" : pendingCount}
                                        </span>
                                    )}
                                </span>
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}

                    {/* More button */}
                    <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
                        <SheetTrigger asChild>
                            <button className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <MoreHorizontal className="h-5 w-5" />
                                <span>Lainnya</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="flex flex-col h-[80vh]">
                            <SheetHeader>
                                <SheetTitle>Menu</SheetTitle>
                            </SheetHeader>
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin">
                                <div className="grid grid-cols-4 gap-4">
                                    {filteredMainNav.map((item, index) => {
                                        if (isNavGroup(item)) {
                                            return item.items.map((subItem, subIndex) => {
                                                const Icon = subItem.icon;
                                                const isActive = pathname.startsWith(subItem.href);

                                                return (
                                                    <Link
                                                        key={`${index}-${subIndex}`}
                                                        href={subItem.href}
                                                        onClick={() => setIsMoreOpen(false)}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors",
                                                            isActive
                                                                ? "bg-accent text-accent-foreground"
                                                                : "hover:bg-muted"
                                                        )}
                                                    >
                                                        {Icon && <Icon className="h-6 w-6" />}
                                                        <span className="text-xs font-medium line-clamp-2">
                                                            {subItem.title}
                                                        </span>
                                                    </Link>
                                                );
                                            });
                                        }

                                        const Icon = item.icon;
                                        const isActive = pathname.startsWith(item.href);

                                        return (
                                            <Link
                                                key={index}
                                                href={item.href}
                                                onClick={() => setIsMoreOpen(false)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-2 rounded-lg p-3 text-center transition-colors",
                                                    isActive
                                                        ? "bg-accent text-accent-foreground"
                                                        : "hover:bg-muted"
                                                )}
                                            >
                                                {Icon && <Icon className="h-6 w-6" />}
                                                <span className="text-xs font-medium line-clamp-2">
                                                    {item.title}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>
        </>
    );
}
