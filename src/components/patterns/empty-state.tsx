"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FileQuestion,
    Search,
    Plus,
    RefreshCw,
    Inbox,
    type LucideIcon,
} from "lucide-react";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

/**
 * Reusable Empty State Component
 * Displays when there is no data to show
 */
export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    secondaryAction,
    className,
}: EmptyStateProps) {
    return (
        <Card className={className}>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                {description && (
                    <p className="text-muted-foreground mb-6 max-w-md">
                        {description}
                    </p>
                )}
                {(action || secondaryAction) && (
                    <div className="flex gap-4">
                        {action && (
                            <Button onClick={action.onClick}>
                                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                                {action.label}
                            </Button>
                        )}
                        {secondaryAction && (
                            <Button variant="outline" onClick={secondaryAction.onClick}>
                                {secondaryAction.label}
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Preset empty states for common scenarios
 */
export function NoDataEmptyState({
    entityName,
    onAdd,
}: {
    entityName: string;
    onAdd?: () => void;
}) {
    return (
        <EmptyState
            icon={Inbox}
            title={`Belum ada ${entityName}`}
            description={`Mulai dengan menambahkan ${entityName} baru.`}
            action={
                onAdd
                    ? {
                        label: `Tambah ${entityName}`,
                        onClick: onAdd,
                        icon: Plus,
                    }
                    : undefined
            }
        />
    );
}

export function NoSearchResultsEmptyState({
    searchTerm,
    onReset,
}: {
    searchTerm: string;
    onReset: () => void;
}) {
    return (
        <EmptyState
            icon={Search}
            title="Tidak ada hasil"
            description={`Tidak ditemukan hasil untuk "${searchTerm}". Coba kata kunci lain.`}
            action={{
                label: "Reset Pencarian",
                onClick: onReset,
                icon: RefreshCw,
            }}
        />
    );
}

export function NoPermissionEmptyState() {
    return (
        <EmptyState
            icon={FileQuestion}
            title="Akses Ditolak"
            description="Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi administrator untuk informasi lebih lanjut."
        />
    );
}

export function ErrorEmptyState({
    message,
    onRetry,
}: {
    message?: string;
    onRetry?: () => void;
}) {
    return (
        <EmptyState
            icon={FileQuestion}
            title="Terjadi Kesalahan"
            description={message || "Gagal memuat data. Silakan coba lagi."}
            action={
                onRetry
                    ? {
                        label: "Coba Lagi",
                        onClick: onRetry,
                        icon: RefreshCw,
                    }
                    : undefined
            }
        />
    );
}
