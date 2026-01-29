"use client";

import * as React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Info, AlertCircle } from "lucide-react";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void | Promise<void>;
    isLoading?: boolean;
}

/**
 * Reusable Confirmation Dialog Component
 * Used for destructive actions like delete, void, etc.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Konfirmasi",
    cancelLabel = "Batal",
    variant = "danger",
    onConfirm,
    isLoading = false,
}: ConfirmDialogProps) {
    const [loading, setLoading] = React.useState(false);

    const isProcessing = isLoading || loading;

    const handleConfirm = async () => {
        try {
            setLoading(true);
            await onConfirm();
            onOpenChange(false);
        } catch (error) {
            console.error("Confirm action failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const variantConfig = {
        danger: {
            icon: AlertTriangle,
            iconBg: "bg-red-100 dark:bg-red-900/30",
            iconColor: "text-red-600 dark:text-red-400",
            buttonVariant: "destructive" as const,
        },
        warning: {
            icon: AlertCircle,
            iconBg: "bg-amber-100 dark:bg-amber-900/30",
            iconColor: "text-amber-600 dark:text-amber-400",
            buttonVariant: "default" as const,
        },
        info: {
            icon: Info,
            iconBg: "bg-blue-100 dark:bg-blue-900/30",
            iconColor: "text-blue-600 dark:text-blue-400",
            buttonVariant: "default" as const,
        },
    };

    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-start gap-4">
                        <div className={`rounded-full p-2 ${config.iconBg}`}>
                            <Icon className={`h-5 w-5 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <AlertDialogTitle>{title}</AlertDialogTitle>
                            <AlertDialogDescription className="mt-2">
                                {description}
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <Button
                        variant={config.buttonVariant}
                        onClick={handleConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Memproses...
                            </>
                        ) : (
                            confirmLabel
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Hook for using confirm dialog
 * Provides a simple API for showing confirmation dialogs
 */
export function useConfirmDialog() {
    const [dialogProps, setDialogProps] = React.useState<{
        open: boolean;
        title: string;
        description: string;
        confirmLabel?: string;
        variant?: "danger" | "warning" | "info";
        onConfirm: () => void | Promise<void>;
    }>({
        open: false,
        title: "",
        description: "",
        onConfirm: () => { },
    });

    const confirm = React.useCallback(
        (options: {
            title: string;
            description: string;
            confirmLabel?: string;
            variant?: "danger" | "warning" | "info";
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                setDialogProps({
                    ...options,
                    open: true,
                    onConfirm: () => {
                        resolve(true);
                    },
                });
            });
        },
        []
    );

    const close = React.useCallback(() => {
        setDialogProps((prev) => ({ ...prev, open: false }));
    }, []);

    const Dialog = React.useCallback(
        () => (
            <ConfirmDialog
                {...dialogProps}
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            />
        ),
        [dialogProps, close]
    );

    return { confirm, Dialog, close };
}

/**
 * Preset confirm dialogs for common actions
 */
export function DeleteConfirmDialog({
    open,
    onOpenChange,
    itemName,
    onConfirm,
    isLoading,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemName: string;
    onConfirm: () => void | Promise<void>;
    isLoading?: boolean;
}) {
    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            title={`Hapus ${itemName}?`}
            description={`Anda yakin ingin menghapus ${itemName}? Tindakan ini tidak dapat dibatalkan.`}
            confirmLabel="Hapus"
            variant="danger"
            onConfirm={onConfirm}
            isLoading={isLoading}
        />
    );
}
