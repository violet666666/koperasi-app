"use client";

import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { useSession } from "next-auth/react";

export default function RestoTambahMenuPage() {
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "resto";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Menu"
                description="Tambah menu baru ke daftar Resto"
                backHref="/resto/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/resto/produk" />
        </div>
    );
}
