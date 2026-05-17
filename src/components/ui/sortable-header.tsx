"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

interface SortableHeaderProps {
    label: string;
    field: string;
    currentField: string;
    currentOrder: "asc" | "desc";
    onSort: (field: string) => void;
    className?: string;
    align?: "left" | "center" | "right";
}

export function SortableHeader({
    label,
    field,
    currentField,
    currentOrder,
    onSort,
    className = "",
    align = "left",
}: SortableHeaderProps) {
    const isActive = currentField === field;
    return (
        <TableHead
            className={`cursor-pointer select-none hover:bg-muted/70 transition-colors whitespace-nowrap ${
                align === "right" ? "text-right" : align === "center" ? "text-center" : ""
            } ${className}`}
            onClick={() => onSort(field)}
        >
            <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
                {label}
                {isActive ? (
                    currentOrder === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5 text-primary" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-primary" />
                    )
                ) : (
                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                )}
            </div>
        </TableHead>
    );
}
