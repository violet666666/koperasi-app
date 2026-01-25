"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
    exportToExcel,
    exportToPDF,
    type ExportColumn,
    formatCurrencyExport,
    formatDateExport,
} from "@/lib/utils/export";
import { toast } from "sonner";

interface ExportButtonProps {
    data: Record<string, any>[];
    columns: ExportColumn[];
    filename: string;
    title?: string;
    subtitle?: string;
    orientation?: "portrait" | "landscape";
    disabled?: boolean;
}

/**
 * Reusable Export Button Component
 * Provides Excel and PDF export options via dropdown
 */
export function ExportButton({
    data,
    columns,
    filename,
    title,
    subtitle,
    orientation = "portrait",
    disabled = false,
}: ExportButtonProps) {
    const [isExporting, setIsExporting] = React.useState(false);

    const handleExport = async (format: "excel" | "pdf") => {
        if (data.length === 0) {
            toast.error("Tidak ada data untuk diekspor");
            return;
        }

        setIsExporting(true);

        try {
            // Small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 100));

            const options = {
                filename: `${filename}_${new Date().toISOString().slice(0, 10)}`,
                title,
                subtitle,
                columns,
                data,
                orientation,
            };

            if (format === "excel") {
                exportToExcel(options);
                toast.success("File Excel berhasil diunduh");
            } else {
                exportToPDF(options);
                toast.success("File PDF berhasil diunduh");
            }
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Gagal mengekspor data");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={disabled || isExporting}>
                    {isExporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Re-export formatters for convenience
export { formatCurrencyExport, formatDateExport };
