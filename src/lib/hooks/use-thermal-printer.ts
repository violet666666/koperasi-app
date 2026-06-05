"use client";

import { useRef, useState, useEffect } from "react";
import { chunkBytes } from "@/lib/escpos";

export type ConnectionType = "usb" | "bluetooth";

interface StoredPrinter {
  type: ConnectionType;
  id: string;
  name: string | null;
}

const STORAGE_KEY = "thermal_printer";

const SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb";
const CHAR_UUID_FF02 = "0000ff02-0000-1000-8000-00805f9b34fb";
const CHAR_UUID_FF01 = "0000ff01-0000-1000-8000-00805f9b34fb";

function loadStored(): StoredPrinter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPrinter;
  } catch {
    return null;
  }
}

function saveStored(printer: StoredPrinter) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
  } catch {
    // localStorage may be unavailable
  }
}

function clearStored() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function classifyError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotFoundError":
        return "Pemilihan printer dibatalkan";
      case "NetworkError":
        return "Printer terputus";
      case "InvalidStateError":
        return "Koneksi printer gagal";
      case "NotSupportedError":
        return "Printer tidak kompatibel";
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export interface UseThermalPrinterReturn {
  isSupported: boolean;
  connectionType: ConnectionType | null;
  isConnecting: boolean;
  isPrinting: boolean;
  pairedDeviceName: string | null;
  pairUSB: () => Promise<boolean>;
  pairBluetooth: () => Promise<boolean>;
  print: (data: Uint8Array) => Promise<boolean>;
  disconnect: () => void;
  forgetDevice: () => void;
  error: string | null;
}

export function useThermalPrinter(): UseThermalPrinterReturn {
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;
  const btSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;
  const isSupported = serialSupported || btSupported;

  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pairedDeviceName, setPairedDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const btDeviceRef = useRef<BluetoothDevice | null>(null);
  const btCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const mountedRef = useRef(true);

  // ── USB helpers ──────────────────────────────────────────────────

  async function openSerialPort(port: SerialPort): Promise<void> {
    if (!port.readable || !port.writable) {
      await port.open({ baudRate: 9600 });
    }
  }

  // ── Bluetooth helpers ────────────────────────────────────────────

  async function getWriteCharacteristic(
    server: BluetoothRemoteGATTServer
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const service = await server.getPrimaryService(SERVICE_UUID);
    try {
      return await service.getCharacteristic(CHAR_UUID_FF02);
    } catch {
      return await service.getCharacteristic(CHAR_UUID_FF01);
    }
  }

  function handleBtDisconnect() {
    if (!mountedRef.current) return;
    btCharRef.current = null;
    setConnectionType(null);
    setPairedDeviceName(null);
  }

  // ── pairUSB ──────────────────────────────────────────────────────

  async function pairUSB(): Promise<boolean> {
    setError(null);
    if (!serialSupported) {
      setError("Web Serial tidak didukung di browser ini");
      return false;
    }

    setIsConnecting(true);
    try {
      const port = await navigator.serial!.requestPort();
      await openSerialPort(port);

      portRef.current = port;
      const info = port.info;
      const name =
        info?.usbVendorId && info?.usbProductId
          ? `USB ${info.usbVendorId}:${info.usbProductId}`
          : "USB Printer";

      // We cannot get a stable ID from SerialPort, so we store a marker
      saveStored({ type: "usb", id: "usb-serial", name });

      setConnectionType("usb");
      setPairedDeviceName(name);
      return true;
    } catch (err: unknown) {
      const msg = classifyError(err);
      setError(msg);
      return false;
    } finally {
      if (mountedRef.current) setIsConnecting(false);
    }
  }

  // ── pairBluetooth ────────────────────────────────────────────────

  async function pairBluetooth(): Promise<boolean> {
    setError(null);
    if (!btSupported) {
      setError("Web Bluetooth tidak didukung di browser ini");
      return false;
    }

    setIsConnecting(true);
    try {
      let device: BluetoothDevice;
      try {
        device = await navigator.bluetooth!.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID],
        });
      } catch (filterErr: unknown) {
        // Device may not advertise the service — fall back to acceptAllDevices
        if (
          filterErr instanceof DOMException &&
          filterErr.name === "NotFoundError"
        ) {
          // User cancelled — don't retry
          throw filterErr;
        }
        device = await navigator.bluetooth!.requestDevice({
          acceptAllDevices: true,
          optionalServices: [SERVICE_UUID],
        });
      }

      const server = await device.gatt!.connect();
      const characteristic = await getWriteCharacteristic(server);

      device.addEventListener("gattserverdisconnected", handleBtDisconnect);

      btDeviceRef.current = device;
      btCharRef.current = characteristic;

      const storedName = device.name ?? "Bluetooth Printer";
      saveStored({ type: "bluetooth", id: device.id, name: storedName });

      setConnectionType("bluetooth");
      setPairedDeviceName(storedName);
      return true;
    } catch (err: unknown) {
      const msg = classifyError(err);
      setError(msg);
      return false;
    } finally {
      if (mountedRef.current) setIsConnecting(false);
    }
  }

  // ── print ────────────────────────────────────────────────────────

  async function print(data: Uint8Array): Promise<boolean> {
    setError(null);

    if (connectionType === "usb" && portRef.current) {
      return printUSB(data);
    }
    if (connectionType === "bluetooth" && btDeviceRef.current) {
      return printBluetooth(data);
    }

    setError("Belum ada printer yang terhubung");
    return false;
  }

  async function printUSB(data: Uint8Array): Promise<boolean> {
    const port = portRef.current;
    if (!port) {
      setError("Port USB tidak ditemukan");
      return false;
    }

    setIsPrinting(true);
    try {
      await openSerialPort(port);
      const writer = port.writable!.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
      return true;
    } catch (err: unknown) {
      const msg = classifyError(err);
      setError(msg);
      return false;
    } finally {
      if (mountedRef.current) setIsPrinting(false);
    }
  }

  async function printBluetooth(data: Uint8Array): Promise<boolean> {
    const device = btDeviceRef.current;
    if (!device?.gatt) {
      setError("Perangkat Bluetooth tidak ditemukan");
      return false;
    }

    setIsPrinting(true);
    try {
      // Reconnect if necessary
      let characteristic = btCharRef.current;
      if (!characteristic) {
        const server = await device.gatt.connect();
        characteristic = await getWriteCharacteristic(server);
        btCharRef.current = characteristic;
      }

      const chunks = chunkBytes(data, 100);
      const writeFn = characteristic.properties.writeWithoutResponse
        ? characteristic.writeValueWithoutResponse.bind(characteristic)
        : characteristic.writeValue.bind(characteristic);

      for (const chunk of chunks) {
        await writeFn(chunk as unknown as BufferSource);
        // Small delay between chunks to avoid buffer overflow
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return true;
    } catch (err: unknown) {
      const msg = classifyError(err);
      setError(msg);
      // Invalidate stale characteristic on error
      btCharRef.current = null;
      return false;
    } finally {
      if (mountedRef.current) setIsPrinting(false);
    }
  }

  // ── disconnect ───────────────────────────────────────────────────

  function disconnect() {
    // USB
    if (portRef.current) {
      const port = portRef.current;
      portRef.current = null;
      if (port.readable || port.writable) {
        port.close().catch(() => {});
      }
    }

    // Bluetooth
    if (btDeviceRef.current) {
      btDeviceRef.current.removeEventListener(
        "gattserverdisconnected",
        handleBtDisconnect
      );
      if (btDeviceRef.current.gatt?.connected) {
        btDeviceRef.current.gatt.disconnect();
      }
      btDeviceRef.current = null;
      btCharRef.current = null;
    }

    setConnectionType(null);
    setPairedDeviceName(null);
  }

  // ── forgetDevice ─────────────────────────────────────────────────

  function forgetDevice() {
    disconnect();
    clearStored();
  }

  // ── Auto-reconnect on mount ──────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    const stored = loadStored();
    if (!stored) return;

    let cancelled = false;

    async function reconnect() {
      if (cancelled || !mountedRef.current) return;

      // Capture stored info in local constants so narrowing survives awaits
      const info = loadStored();
      if (!info) return;

      if (info.type === "usb" && serialSupported) {
        try {
          const ports = await navigator.serial!.getPorts();
          if (ports.length > 0) {
            const port = ports[0];
            await openSerialPort(port);
            portRef.current = port;
            if (!cancelled && mountedRef.current) {
              setConnectionType("usb");
              setPairedDeviceName(info.name ?? "USB Printer");
            }
          }
        } catch {
          // Silent fail — user can re-pair
        }
      } else if (info.type === "bluetooth" && btSupported) {
        try {
          // getDevices() may not be available in all browsers
          if (typeof navigator.bluetooth!.getDevices === "function") {
            const devices = await navigator.bluetooth!.getDevices!();
            const match = devices.find((d: BluetoothDevice) => d.id === info.id);
            if (match && match.gatt && !cancelled && mountedRef.current) {
              const server = await match.gatt.connect();
              const characteristic = await getWriteCharacteristic(server);

              match.addEventListener(
                "gattserverdisconnected",
                handleBtDisconnect
              );

              btDeviceRef.current = match;
              btCharRef.current = characteristic;

              if (!cancelled && mountedRef.current) {
                setConnectionType("bluetooth");
                setPairedDeviceName(info.name ?? match.name ?? "Bluetooth Printer");
              }
            }
          }
        } catch {
          // Silent fail — user can re-pair
        }
      }
    }

    reconnect();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isSupported,
    connectionType,
    isConnecting,
    isPrinting,
    pairedDeviceName,
    pairUSB,
    pairBluetooth,
    print,
    disconnect,
    forgetDevice,
    error,
  };
}
