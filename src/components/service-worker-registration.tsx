"use client";

import * as React from "react";

// Keys to ensure we only auto-reload ONCE per new SW activation (avoid loops).
const RELOAD_KEY = "sw-reloaded-v2";

export function ServiceWorkerRegistration() {
    React.useEffect(() => {
        if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

        const register = async () => {
            try {
                const registration = await navigator.serviceWorker.register("/sw.js");
                console.log("[SW] registered:", registration.scope);

                // Force immediate update check (don't wait up to 24h browser cache).
                registration.update();

                // New SW installed & activated → take control. Tell client to reload once.
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener("statechange", () => {
                        if (
                            newWorker.state === "activated" &&
                            navigator.serviceWorker.controller &&
                            !sessionStorage.getItem(RELOAD_KEY)
                        ) {
                            sessionStorage.setItem(RELOAD_KEY, "1");
                            window.location.reload();
                        }
                    });
                });
            } catch (error) {
                console.error("[SW] registration failed:", error);
            }
        };

        // Also catch external controller swaps (e.g. skipWaiting from another tab).
        const onControllerChange = () => {
            if (!sessionStorage.getItem(RELOAD_KEY)) {
                sessionStorage.setItem(RELOAD_KEY, "1");
                window.location.reload();
            }
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        void register();
        return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }, []);

    return null;
}
