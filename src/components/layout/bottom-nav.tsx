"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { bottomNavigation } from "@/lib/constants/navigation";
import { MoreHorizontal } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mainNavigation, isNavGroup } from "@/lib/constants/navigation";

export function BottomNav() {
    const pathname = usePathname();
    const [isMoreOpen, setIsMoreOpen] = React.useState(false);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex h-16 items-center justify-around px-2">
                {bottomNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                                isActive
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {Icon && (
                                <Icon
                                    className={cn("h-5 w-5", isActive && "text-primary")}
                                />
                            )}
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
                    <SheetContent side="bottom" className="h-[80vh]">
                        <SheetHeader>
                            <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-full py-4">
                            <div className="grid grid-cols-4 gap-4">
                                {mainNavigation.map((item, index) => {
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
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
        </nav>
    );
}
