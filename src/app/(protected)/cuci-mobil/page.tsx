import { redirect } from "next/navigation";

// Root unit tanpa konten sendiri — arahkan ke halaman utama unit.
// (Membenahi 404 prefetch dari breadcrumb topbar & link sidebar /cuci-mobil)
export default function Page() {
    redirect("/cuci-mobil/kasir");
}
