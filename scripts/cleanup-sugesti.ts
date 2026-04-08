/**
 * Script: Cleanup Pengajuan Pinjaman Duplikat - SUGESTI (NRP: 00000006)
 * Run: npx tsx scripts/cleanup-sugesti.ts
 * PRODUCTION DB only (set DATABASE_URL to prod Neon via env)
 */
import prisma from "../src/lib/prisma";

async function main() {
    // 1. Cari member SUGESTI
    const member = await prisma.member.findFirst({
        where: {
            OR: [
                { name: { contains: "SUGESTI", mode: "insensitive" } },
                { nrp: "00000006" },
            ],
        },
        select: { id: true, name: true, nrp: true, memberNo: true },
    });

    if (!member) {
        console.log("❌ Member SUGESTI tidak ditemukan.");
        return;
    }
    console.log(`✅ Member ditemukan: ${member.name} | NRP: ${member.nrp} | ID: ${member.id}`);

    // 2. Cari semua pengajuan pinjaman-nya
    const applications = await prisma.loanApplication.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        include: {
            loan: { select: { id: true, loanNo: true } },
        },
    });

    console.log(`\n📋 Ditemukan ${applications.length} pengajuan:`);
    for (const app of applications) {
        console.log(`  - ID: ${app.id} | No: ${app.applicationNo} | Status: ${app.status} | Dibuat: ${app.createdAt.toISOString()} | Loan: ${app.loan ? app.loan.loanNo : "-"}`);
    }

    if (applications.length === 0) {
        console.log("Tidak ada data yang perlu dihapus.");
        return;
    }

    // 3. Filter hanya pengajuan yang belum dicairkan (aman dihapus)
    const toDelete = applications.filter(a => a.status !== "disbursed" || !a.loan);
    const disbursed = applications.filter(a => a.status === "disbursed" && a.loan);

    if (disbursed.length > 0) {
        console.log(`\n⚠️  Ada ${disbursed.length} pengajuan yang SUDAH DICAIRKAN - TIDAK akan dihapus:`);
        disbursed.forEach(a => console.log(`    - ${a.applicationNo} | Loan: ${a.loan?.loanNo}`));
    }

    if (toDelete.length === 0) {
        console.log("\nTidak ada pengajuan draft yang perlu dihapus.");
        return;
    }

    console.log(`\n🗑️  Akan menghapus ${toDelete.length} pengajuan (status draft/submitted/approved)...`);
    
    for (const app of toDelete) {
        await prisma.loanApplication.delete({ where: { id: app.id } });
        console.log(`  ✅ Deleted: ${app.applicationNo} (${app.status})`);
    }

    console.log("\n✅ Cleanup selesai.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
