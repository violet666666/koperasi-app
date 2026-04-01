import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const session = await auth();
        
        const journalId = parseInt(resolvedParams.id);
        if (isNaN(journalId)) {
            return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
        }

        // Must ensure we only delete NON_SP_IN
        const journal = await prisma.journal.findUnique({
            where: { id: journalId },
        });

        if (!journal || journal.sourceType !== "NON_SP_IN") {
            return NextResponse.json({ message: "Penerimaan tidak valid" }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            // Un-link any CashBankTransaction that might have tied to this journal
            await tx.cashBankTransaction.updateMany({
                where: { journalId: journalId },
                data: { journalId: null },
            });
            
            // Delete Journal Lines
            await tx.journalLine.deleteMany({
                where: { journalId: journalId },
            });
            // Delete Journal
            await tx.journal.delete({
                where: { id: journalId },
            });
        });

        return NextResponse.json({ message: "Berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/non-sp/penerimaan/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus" }, { status: 500 });
    }
}
