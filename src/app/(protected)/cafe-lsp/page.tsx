import { redirect } from "next/navigation";

// Root unit tanpa konten sendiri — arahkan ke halaman utama unit.
// (Membenahi 404 prefetch dari breadcrumb topbar & link sidebar /cafe-lsp)
export default function Page() {
    redirect("/cafe-lsp/kasir");
}
