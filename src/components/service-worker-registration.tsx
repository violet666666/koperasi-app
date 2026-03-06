"use client";

import * as React from "react";

export function ServiceWorkerRegistration() {
    React.useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("SW registered:", registration.scope);

                    // Check for updates periodically
                    registration.addEventListener("updatefound", () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener("statechange", () => {
                                if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                                    console.log("New service worker activated - content updated");
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.error("SW registration failed:", error);
                });
        }
    }, []);

    return null;
}
