import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
    title: string;
    description?: string;
    backHref?: string;
    backLabel?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    backHref,
    backLabel = "Kembali",
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("space-y-2", className)}>
            {backHref && (
                <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                    <Link href={backHref}>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        {backLabel}
                    </Link>
                </Button>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground">{description}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}
