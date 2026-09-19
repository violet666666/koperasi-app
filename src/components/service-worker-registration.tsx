"use client";

import * as React from "react";

// Reload at most once per page load (in-memory). Loop-safe: after reload the new
// SW already controls the page, so no activation event fires again until the NEXT
// deploy's worker activates — which correctly triggers another reload.
// ponytail: per-deploy reload; if a deploy ever needs forced multi-reload, key off SW build id instead.
let reloadedThisPageLoad = false;

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
                            !reloadedThisPageLoad
                        ) {
                            reloadedThisPageLoad = true;
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
            if (!reloadedThisPageLoad) {
                reloadedThisPageLoad = true;
                window.location.reload();
            }
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        void register();
        return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }, []);

    return null;
}
