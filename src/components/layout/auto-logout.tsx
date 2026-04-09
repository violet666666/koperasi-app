"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/hooks";
import { toast } from "sonner";

export function AutoLogout() {
    const { logout, user } = useAuth();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Jika tidak ada user yang login, timer tidak perlu berjalan
        if (!user) return;

        const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name || "";
        
        // Aturan timeout (dalam menit):
        // Kasir & Admin Unit = 12 jam (720 menit)
        // Operator / Default = 1 jam (60 menit)
        let timeoutMinutes = 60; 
        if (roleName === "kasir" || roleName === "admin") {
            timeoutMinutes = 12 * 60;
        }

        const timeoutMs = timeoutMinutes * 60 * 1000;

        const resetTimer = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                toast.warning("Sesi Berakhir Otomatis", {
                    description: `Sistem mendeteksi Anda meninggalkan layar tanpa aktivitas selama ${
                        timeoutMinutes >= 60 ? `${timeoutMinutes / 60} jam` : `${timeoutMinutes} menit`
                    }. Demi keamanan, Anda telah dilogout.`,
                    duration: 6000,
                });
                logout();
            }, timeoutMs);
        };

        // Initialize first timer
        resetTimer();

        // Throttle logic to prevent hitting resetTimer too frequently on mousemove
        let throttleTimer: NodeJS.Timeout | null = null;
        const handleActivity = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                throttleTimer = null;
            }, 500); // 500ms max update rate
            resetTimer();
        };

        const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
        
        events.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [user, logout]);

    return null; // Komponen background (tanpa UI)
}
