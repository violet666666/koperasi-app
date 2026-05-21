"use client";

import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { useSession } from "next-auth/react";

export default function CafeLspTambahMenuPage() {
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "cafe_lsp";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Menu"
                description="Tambah menu baru ke daftar Cafe LSP"
                backHref="/cafe-lsp/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/cafe-lsp/produk" />
        </div>
    );
}
