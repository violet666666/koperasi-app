"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { User, Branch } from "@/types";

interface AppShellProps {
    children: React.ReactNode;
    user?: User | null;
    branches?: Branch[];
    currentBranchId?: number | null;
    onBranchChange?: (branchId: number | null) => void;
}

export function AppShell({
    children,
    user,
    branches = [],
    currentBranchId,
    onBranchChange,
}: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    return (
        <div className="relative flex min-h-screen">
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
                <SheetContent side="left" className="w-64 p-0">
                    <Sidebar isCollapsed={false} />
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
                    branches={branches}
                    currentBranchId={currentBranchId}
                    onBranchChange={onBranchChange}
                    onMenuClick={() => setMobileMenuOpen(true)}
                />

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
            </div>

            {/* Bottom Navigation (Mobile) */}
            <BottomNav />
        </div>
    );
}
