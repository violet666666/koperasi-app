"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bluetooth, Usb, Printer, Loader2 } from "lucide-react";
import { useThermalPrinter } from "@/lib/hooks/use-thermal-printer";
import { textToEscPos } from "@/lib/escpos";
import {
  generateRawText,
  type ReceiptData,
} from "@/components/patterns/receipt-primkopol";
import { toast } from "sonner";

interface BluetoothPrintButtonProps {
  receiptData: ReceiptData;
  paperSize?: "58mm" | "80mm";
}

export function BluetoothPrintButton({
  receiptData,
  paperSize = "58mm",
}: BluetoothPrintButtonProps) {
  const {
    isSupported,
    connectionType,
    isConnecting,
    isPrinting,
    pairedDeviceName,
    pairUSB,
    pairBluetooth,
    print,
    error,
  } = useThermalPrinter();

  if (!isSupported) return null;

  if (error) {
    toast.error(error);
  }

  const handlePrint = async () => {
    const text = generateRawText(receiptData, paperSize);
    const bytes = textToEscPos(text, { paperSize });
    const ok = await print(bytes);
    if (ok) {
      toast.success("Struk berhasil dicetak!");
    }
    // error is surfaced via hook's error state → toast above
  };

  const deviceLabel =
    connectionType === "usb"
      ? "Cetak USB"
      : connectionType === "bluetooth"
        ? "Cetak Bluetooth"
        : null;

  const DeviceIcon = connectionType === "usb" ? Usb : Bluetooth;

  if (isConnecting) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Menghubungkan...
      </Button>
    );
  }

  if (isPrinting) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Mencetak...
      </Button>
    );
  }

  if (connectionType && pairedDeviceName) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-green-500 text-green-700 hover:bg-green-50"
        onClick={handlePrint}
      >
        <DeviceIcon className="h-4 w-4" />
        {deviceLabel}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Cetak Langsung
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={pairUSB}>
          <Usb className="mr-2 h-4 w-4" />
          USB (Kabel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={pairBluetooth}>
          <Bluetooth className="mr-2 h-4 w-4" />
          Bluetooth
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
