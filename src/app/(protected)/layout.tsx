import type { ReactNode } from "react";
import { ProtectedShell } from "./protected-shell";

// ponytail: server component (no "use client") so `force-dynamic` is honored.
// The previous layout was "use client", which silently ignored this export and
// let Next.js statically prerender protected routes — same latent cache-poisoning
// bomb as portal (brotli RSC-flight variant served for HTML navs). Defense is
// doubled by proxy.ts setting no-store on all protected responses, but keeping
// the route dynamic here removes the root cause (no flight/HTML cache split).
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
    return <ProtectedShell>{children}</ProtectedShell>;
}
