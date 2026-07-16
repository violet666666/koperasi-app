"use client";

import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// ponytail: emergency SW cleanup page. Visiting this URL unregisters all
// service workers + clears all caches, then redirects to /login. Exists so
// users stuck on the white-screen (stale cached flight payload) can self-heal
// without DevTools. Safe to delete once v2 SW is confirmed fleet-wide.
export default function SwCleanupPage() {
    const [status, setStatus] = React.useState<"running" | "done" | "error">("running");
    const [log, setLog] = React.useState<string[]>([]);

    const push = (line: string) => setLog((l) => [...l, line]);

    React.useEffect(() => {
        (async () => {
            try {
                if ("serviceWorker" in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of regs) {
                        await r.unregister();
                        push(`Unregistered SW: ${r.scope}`);
                    }
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k).then(() => push(`Deleted cache: ${k}`))));
                }
                setStatus("done");
                push("Done. Redirecting to login...");
                setTimeout(() => { window.location.href = "/login"; }, 1500);
            } catch (e) {
                push(`Error: ${e instanceof Error ? e.message : String(e)}`);
                setStatus("error");
            }
        })();
    }, []);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="max-w-md w-full space-y-4">
                <div className="flex justify-center">
                    {status === "running" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                    {status === "done" && <CheckCircle2 className="h-12 w-12 text-green-600" />}
                    {status === "error" && <AlertCircle className="h-12 w-12 text-red-600" />}
                </div>
                <h1 className="text-xl font-bold">Memperbaiki cache aplikasi...</h1>
                <p className="text-sm text-muted-foreground">
                    Service worker lama sedang dibersihkan. Halaman akan kembali otomatis.
                </p>
                <pre className="text-left text-xs bg-slate-900 text-slate-100 rounded-lg p-3 max-h-48 overflow-auto">
                    {log.length ? log.join("\n") : "Memulai..."}
                </pre>
                <a href="/login" className="inline-block text-sm text-primary hover:underline">
                    Lanjut ke login manual →
                </a>
            </div>
        </main>
    );
}
