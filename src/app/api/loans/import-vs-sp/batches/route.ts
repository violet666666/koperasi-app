import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/loans/import-vs-sp/batches
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const batches = await prisma.importBatch.findMany({
      where: { type: "import_vs_sp" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        batchNo: true,
        fileName: true,
        sheetName: true,
        period: true,
        totalRows: true,
        successCount: true,
        errorCount: true,
        loanIds: true,
        paymentIds: true,
        memberIds: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("GET /api/loans/import-vs-sp/batches error:", error);
    return NextResponse.json(
      { message: "Gagal mengambil data batch" },
      { status: 500 }
    );
  }
}
