"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { User } from "@/types";

interface AppShellProps {
    children: React.ReactNode;
    user?: User | null;
    onLogout?: () => void;
}

export function AppShell({
    children,
    user,
    onLogout,
}: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    return (
        <div className="relative flex min-h-[100dvh]">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar
                    isCollapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="fixed inset-y-0 left-0 z-30"
                />
            </div>

            {/* Mobile Sidebar (Sheet) */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="left" className="w-64 p-0 flex flex-col h-full overflow-hidden" aria-describedby={undefined}>
                    <VisuallyHidden>
                        <SheetTitle>Menu Navigasi</SheetTitle>
                    </VisuallyHidden>
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full">
                        <Sidebar isCollapsed={false} className="border-none min-h-0 flex-1 w-full" />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <div
                className={cn(
                    "flex flex-1 flex-col",
                    sidebarCollapsed ? "lg:pl-16" : "lg:pl-64",
                    "transition-all duration-300"
                )}
            >
                {/* Topbar */}
                <Topbar
                    user={user}
                    onMenuClick={() => setMobileMenuOpen(true)}
                    onLogout={onLogout}
                />

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6" style={{ paddingBottom: 'max(5rem, calc(4rem + env(safe-area-inset-bottom, 0px)))' }}>{children}</main>
            </div>

            {/* Bottom Navigation (Mobile) */}
            <BottomNav />
        </div>
    );
}
