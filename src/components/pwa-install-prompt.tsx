"use client";

import * as React from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = React.useState(false);
    const [isInstalled, setIsInstalled] = React.useState(false);

    React.useEffect(() => {
        // Check if already installed
        if (window.matchMedia("(display-mode: standalone)").matches) {
            setIsInstalled(true);
            return;
        }

        // Check if dismissed recently (within 7 days)
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (dismissed) {
            const dismissedAt = new Date(dismissed).getTime();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedAt < sevenDays) return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Show banner after a short delay for better UX
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Check if already installed via appinstalled event
        window.addEventListener("appinstalled", () => {
            setIsInstalled(true);
            setShowBanner(false);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setShowBanner(false);
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
    };

    if (isInstalled || !showBanner) return null;

    return (
        <div
            className={cn(
                "fixed bottom-20 left-4 right-4 z-[60] lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm",
                "animate-slide-in-bottom"
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
            <div className="rounded-xl border bg-card p-4 shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Aplikasi PRIMKOPPOL RESOR LUMAJANG</p>
                        <p className="text-xs text-muted-foreground">Install untuk akses lebih cepat dan notifikasi</p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="shrink-0 text-muted-foreground hover:text-foreground p-1"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex gap-2 mt-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={handleDismiss}
                    >
                        Nanti Saja
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={handleInstall}
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Pasang
                    </Button>
                </div>
            </div>
        </div>
    );
}
