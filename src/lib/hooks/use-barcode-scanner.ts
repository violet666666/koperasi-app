/**
 * useBarcodeScanner
 * 
 * Listens for rapid keyboard input characteristic of barcode gun scanners.
 * Typical barcode guns fire chars in <50ms intervals, ending with Enter.
 * Works with USB/Bluetooth hardware scanners on desktop browsers.
 * 
 * Usage:
 *   useBarcodeScanner((code) => addItemByBarcode(code));
 */

import { useEffect, useRef } from "react";

interface BarcodeScannerOptions {
    /** Minimum barcode length to accept (default: 3) */
    minLength?: number;
    /** Max ms between characters to count as scanner input (default: 60ms) */
    maxInterval?: number;
    /** Whether the scanner hook is active (default: true) */
    enabled?: boolean;
}

export function useBarcodeScanner(
    onScan: (barcode: string) => void,
    options: BarcodeScannerOptions = {}
) {
    const { minLength = 3, maxInterval = 60, enabled = true } = options;

    const bufferRef = useRef<string>("");
    const lastKeyTimeRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is on a text input (user is typing manually)
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") return;

            const now = Date.now();
            const interval = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            // Clear the buffer if gap is too large (manual typing, not scanner)
            if (interval > maxInterval && bufferRef.current.length > 0) {
                bufferRef.current = "";
            }

            if (e.key === "Enter") {
                // Scanner completed — fire if buffer is long enough
                const code = bufferRef.current.trim();
                bufferRef.current = "";
                if (code.length >= minLength) {
                    onScan(code);
                }
                return;
            }

            // Only accumulate printable characters
            if (e.key.length === 1) {
                bufferRef.current += e.key;
            }

            // Auto-clear buffer after 200ms of inactivity (safety net)
            if (timerRef.current !== undefined) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                bufferRef.current = "";
            }, 200);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            clearTimeout(timerRef.current);
        };
    }, [enabled, minLength, maxInterval, onScan]);
}
