"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { printElement, generateReceiptHTML } from "@/lib/utils/print";
import { toast } from "sonner";

interface PrintReceiptButtonProps {
    receiptData: {
        coopName: string;
        coopAddress: string;
        receiptNo: string;
        date: string;
        memberNo: string;
        memberName: string;
        type: string;
        items: Array<{ label: string; amount: number }>;
        total: number;
        operator: string;
    };
}

/**
 * Print Receipt Button Component
 * Generates and prints transaction receipt
 */
export function PrintReceiptButton({ receiptData }: PrintReceiptButtonProps) {
    const [isPrinting, setIsPrinting] = React.useState(false);
    const receiptContainerRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = async () => {
        setIsPrinting(true);

        try {
            // Generate receipt HTML
            const receiptHTML = generateReceiptHTML(receiptData);

            // Create print window
            const printWindow = window.open("", "_blank", "width=400,height=600");
            if (!printWindow) {
                toast.error("Pop-up blocked. Mohon izinkan pop-up untuk mencetak.");
                return;
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Bukti Transaksi - ${receiptData.receiptNo}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Courier New', monospace;
                            padding: 20px;
                            font-size: 12px;
                        }
                        .print-header { text-align: center; margin-bottom: 15px; }
                        .print-header h1 { font-size: 14px; }
                        .print-header p { font-size: 10px; color: #666; }
                        .divider { border-top: 1px dashed #333; margin: 10px 0; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${receiptHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 400);
                        };
                    </script>
                </body>
                </html>
            `);

            printWindow.document.close();
            toast.success("Bukti transaksi dicetak");
        } catch (error) {
            console.error("Print error:", error);
            toast.error("Gagal mencetak bukti transaksi");
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Printer className="mr-2 h-4 w-4" />
            )}
            Cetak Bukti
        </Button>
    );
}

interface PrintButtonProps {
    elementId: string;
    title?: string;
    children?: React.ReactNode;
}

/**
 * Generic Print Button Component
 * Prints content of specified element ID
 */
export function PrintButton({ elementId, title, children }: PrintButtonProps) {
    const [isPrinting, setIsPrinting] = React.useState(false);

    const handlePrint = () => {
        setIsPrinting(true);
        try {
            printElement(elementId, title);
        } catch (error) {
            console.error("Print error:", error);
            toast.error("Gagal mencetak");
        } finally {
            setTimeout(() => setIsPrinting(false), 500);
        }
    };

    return (
        <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Printer className="mr-2 h-4 w-4" />
            )}
            {children || "Cetak"}
        </Button>
    );
}
