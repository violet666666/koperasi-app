"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    mainNavigation,
    isNavGroup,
    getNavigationForUser,
    type NavItem,
    type NavGroup,
} from "@/lib/constants/navigation";
import { useAuth } from "@/lib/hooks";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
    className?: string;
}

export function Sidebar({ isCollapsed = false, className }: SidebarProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    // Read unitType directly from JWT session — guaranteed accurate
    const { data: session } = useSession();
    const filteredNavigation = getNavigationForUser({
        permissions: user?.permissions || [],
        roleName: user?.role?.name || "anggota",
        unitType: session?.user?.unitType ?? null,
    });

    return (
        <aside
            className={cn(
                "flex h-full flex-col bg-sidebar text-sidebar-foreground print:hidden",
                isCollapsed ? "w-16" : "w-64",
                "transition-all duration-300 ease-in-out",
                className
            )}
        >
            {/* Logo */}
            <div
                className={cn(
                    "flex h-16 items-center border-b border-sidebar-border px-4",
                    isCollapsed && "justify-center px-2"
                )}
            >
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg overflow-hidden shrink-0">
                        <img src="/LogoPrimkoppol.png" alt="Logo" className="h-full w-full object-contain transform scale-[2.2]" />
                    </div>
                    {!isCollapsed && (
                        <span className="font-bold text-[15px] leading-tight">PRIMKOPPOL<br />LUMAJANG</span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin overscroll-contain">
                <nav className="space-y-2">
                    {filteredNavigation.map((item, index) => {
                        if (isNavGroup(item)) {
                            return (
                                <NavGroupComponent
                                    key={index}
                                    group={item}
                                    pathname={pathname}
                                    isCollapsed={isCollapsed}
                                />
                            );
                        }
                        return (
                            <NavItemComponent
                                key={index}
                                item={item}
                                pathname={pathname}
                                isCollapsed={isCollapsed}
                            />
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            {!isCollapsed && (
                <div className="border-t border-sidebar-border p-4">
                    <p className="text-xs text-sidebar-foreground/60">
                        © 2025 PRIMKOPPOL RESOR LUMAJANG
                    </p>
                </div>
            )}
        </aside>
    );
}

// Nav Group Component
function NavGroupComponent({
    group,
    pathname,
    isCollapsed,
}: {
    group: NavGroup;
    pathname: string;
    isCollapsed: boolean;
}) {
    if (isCollapsed) {
        return (
            <div className="space-y-1">
                {group.items.map((item, index) => (
                    <NavItemComponent
                        key={index}
                        item={item}
                        pathname={pathname}
                        isCollapsed={isCollapsed}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.title}
            </p>
            {group.items.map((item, index) => (
                <NavItemComponent
                    key={index}
                    item={item}
                    pathname={pathname}
                    isCollapsed={isCollapsed}
                />
            ))}
        </div>
    );
}

// Nav Item Component
function NavItemComponent({
    item,
    pathname,
    isCollapsed,
    depth = 0,
}: {
    item: NavItem;
    pathname: string;
    isCollapsed: boolean;
    depth?: number;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const hasChildren = item.children && item.children.length > 0;
    const isActive =
        pathname === item.href ||
        (hasChildren && item.children?.some((child) => pathname === child.href));
    const Icon = item.icon;

    // Auto-expand if a child is active
    React.useEffect(() => {
        if (hasChildren && item.children?.some((child) => pathname === child.href)) {
            setIsOpen(true);
        }
    }, [pathname, hasChildren, item.children]);

    // Collapsed mode with tooltip
    if (isCollapsed && depth === 0) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href={item.href}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "w-full h-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                                )}
                            >
                                {Icon && <Icon className="h-5 w-5" />}
                            </Button>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col gap-1">
                        <span className="font-medium">{item.title}</span>
                        {hasChildren && (
                            <div className="flex flex-col gap-1 pt-1 border-t">
                                {item.children?.map((child, index) => (
                                    <Link
                                        key={index}
                                        href={child.href}
                                        className={cn(
                                            "text-sm hover:underline",
                                            pathname === child.href && "font-medium"
                                        )}
                                    >
                                        {child.title}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Expanded mode without children
    if (!hasChildren) {
        return (
            <Link href={item.href}>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                        depth > 0 && "pl-10 text-sm"
                    )}
                >
                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    <span className="truncate">{item.title}</span>
                </Button>
            </Link>
        );
    }

    // Expanded mode with children (collapsible)
    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                >
                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    <span className="truncate flex-1 text-left">{item.title}</span>
                    {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1">
                {item.children?.map((child, index) => (
                    <NavItemComponent
                        key={index}
                        item={child}
                        pathname={pathname}
                        isCollapsed={false}
                        depth={depth + 1}
                    />
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
