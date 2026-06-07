"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect to shared unit laporan page.
 * The legacy dedicated page was replaced because it lacked critical features:
 * - Catatan pengeluaran operasional (expense recording)
 * - Catatan pemasukan operasional (income recording)
 * - Laba bersih / net profit calculation
 * - HPP (cost of goods sold)
 * - Period presets & payment method filtering
 * - Excel multi-sheet export
 * - Print layout with kop surat
 * - Pagination & sorting
 *
 * The shared page at /unit/resto/laporan has all of these features
 * and is the same page used by cafe_lsp, toko, barbershop, etc.
 */
export default function RestoLaporanPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/unit/resto/laporan");
    }, [router]);

    return (
        <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
    );
}
