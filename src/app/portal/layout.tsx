import type { ReactNode } from "react";
import { PortalShell } from "./portal-shell";

// ponytail: MUST be a server component (no "use client") so that `force-dynamic`
// is actually honored by Next.js. The previous layout was "use client", which
// silently ignored this export → /portal/* got statically prerendered → Railway
// edge cache served the brotli RSC-flight variant (text/x-component) for HTML
// navigations → white screen showing raw flight payload after portal login.
// force-dynamic disables static prerendering so no flight/HTML cache split exists.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: ReactNode }) {
    return <PortalShell>{children}</PortalShell>;
}
