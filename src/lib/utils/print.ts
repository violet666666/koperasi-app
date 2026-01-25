/**
 * Print utility functions
 * Provides consistent print styling and functionality
 */

/**
 * Print specific element by ID
 */
export function printElement(elementId: string, title?: string): void {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID "${elementId}" not found`);
        return;
    }

    // Create print window
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
        console.error("Failed to open print window");
        return;
    }

    // Write content
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title || "Print"}</title>
            <style>
                ${printStyles}
            </style>
        </head>
        <body>
            ${element.innerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Print after content loads
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

/**
 * Print styles for receipts and documents
 */
export const printStyles = `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        line-height: 1.5;
        color: #000;
        background: #fff;
        padding: 20px;
    }
    
    .print-header {
        text-align: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #333;
    }
    
    .print-header h1 {
        font-size: 18px;
        margin-bottom: 5px;
    }
    
    .print-header p {
        font-size: 11px;
        color: #666;
    }
    
    .print-title {
        text-align: center;
        font-size: 16px;
        font-weight: bold;
        margin: 15px 0;
        text-transform: uppercase;
    }
    
    .print-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 15px;
    }
    
    .print-info-item {
        display: flex;
    }
    
    .print-info-label {
        width: 100px;
        font-weight: 500;
        color: #666;
    }
    
    .print-info-value {
        flex: 1;
        font-weight: 600;
    }
    
    .print-table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
    }
    
    .print-table th,
    .print-table td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }
    
    .print-table th {
        background: #f5f5f5;
        font-weight: 600;
    }
    
    .print-table .text-right {
        text-align: right;
    }
    
    .print-table .text-center {
        text-align: center;
    }
    
    .print-total {
        text-align: right;
        font-size: 14px;
        font-weight: bold;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 2px solid #333;
    }
    
    .print-footer {
        margin-top: 30px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 50px;
        text-align: center;
    }
    
    .print-signature {
        padding-top: 60px;
        border-top: 1px solid #333;
    }
    
    .print-timestamp {
        font-size: 10px;
        color: #999;
        text-align: center;
        margin-top: 20px;
    }
    
    .print-receipt {
        max-width: 300px;
        margin: 0 auto;
        font-family: 'Courier New', monospace;
        font-size: 11px;
    }
    
    .print-receipt .divider {
        border-top: 1px dashed #333;
        margin: 10px 0;
    }
    
    @media print {
        body {
            padding: 0;
        }
        
        .no-print {
            display: none !important;
        }
    }
`;

/**
 * Generate receipt HTML for transaction
 */
export function generateReceiptHTML(data: {
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
}): string {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("id-ID").format(val);

    return `
        <div class="print-receipt">
            <div class="print-header">
                <h1>${data.coopName}</h1>
                <p>${data.coopAddress}</p>
            </div>
            
            <div class="divider"></div>
            
            <p><strong>${data.type.toUpperCase()}</strong></p>
            <p>No: ${data.receiptNo}</p>
            <p>Tanggal: ${data.date}</p>
            
            <div class="divider"></div>
            
            <p>No. Anggota: ${data.memberNo}</p>
            <p>Nama: ${data.memberName}</p>
            
            <div class="divider"></div>
            
            ${data.items.map(item => `
                <div style="display: flex; justify-content: space-between;">
                    <span>${item.label}</span>
                    <span>Rp ${formatCurrency(item.amount)}</span>
                </div>
            `).join("")}
            
            <div class="divider"></div>
            
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>TOTAL</span>
                <span>Rp ${formatCurrency(data.total)}</span>
            </div>
            
            <div class="divider"></div>
            
            <p style="text-align: center; font-size: 10px;">
                Operator: ${data.operator}
            </p>
            <p style="text-align: center; font-size: 10px;">
                Terima kasih atas transaksi Anda
            </p>
        </div>
    `;
}
