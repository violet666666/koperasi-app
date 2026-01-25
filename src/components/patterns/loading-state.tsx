"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
    variant?: "card" | "table" | "list" | "form" | "detail";
    rows?: number;
    className?: string;
}

/**
 * Reusable Loading State Component
 * Displays skeleton loaders in various formats
 */
export function LoadingState({
    variant = "card",
    rows = 5,
    className,
}: LoadingStateProps) {
    switch (variant) {
        case "table":
            return <TableLoadingSkeleton rows={rows} className={className} />;
        case "list":
            return <ListLoadingSkeleton rows={rows} className={className} />;
        case "form":
            return <FormLoadingSkeleton className={className} />;
        case "detail":
            return <DetailLoadingSkeleton className={className} />;
        default:
            return <CardLoadingSkeleton rows={rows} className={className} />;
    }
}

function CardLoadingSkeleton({ rows, className }: { rows: number; className?: string }) {
    return (
        <Card className={className}>
            <CardContent className="p-6 space-y-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}

function TableLoadingSkeleton({ rows, className }: { rows: number; className?: string }) {
    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Header */}
                <div className="flex gap-4 px-4 py-3 border-b bg-muted/50">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
                {/* Rows */}
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-32 flex-1" />
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function ListLoadingSkeleton({ rows, className }: { rows: number; className?: string }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {Array.from({ length: rows }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="flex items-center gap-4 p-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function FormLoadingSkeleton({ className }: { className?: string }) {
    return (
        <Card className={className}>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="flex justify-end gap-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </CardContent>
        </Card>
    );
}

function DetailLoadingSkeleton({ className }: { className?: string }) {
    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <Card>
                <CardContent className="flex items-center gap-6 p-6">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-2 pt-2">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            {/* Info Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-6 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* Table */}
            <TableLoadingSkeleton rows={5} />
        </div>
    );
}

/**
 * Inline loading spinner
 */
export function LoadingSpinner({ className }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center p-8 ${className}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
}

/**
 * Full page loading overlay
 */
export function PageLoadingOverlay() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Memuat...</p>
            </div>
        </div>
    );
}
