import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { records, type } = body; 
        
        if (!records || !Array.isArray(records) || records.length === 0) {
             return NextResponse.json({ message: "Data import kosong atau tidak dikirim" }, { status: 400 });
        }

        let successCount = 0;
        let skipCount = 0;
        let errors = [];

        for (let i = 0; i < records.length; i++) {
             const row = records[i];
             // Standardize NRP Key
             const rawNrp = row["nrp"] || row["Nrp"] || row["NRP"] || row["nip"] || row["NIP"];
             if (!rawNrp) {
                 skipCount++;
                 continue;
             }

             const nrpStr = String(rawNrp).trim();
             if (nrpStr.length < 3) {
                 skipCount++;
                 continue; 
             }

             try {
                // Determine if updating member data or just tunkin
                if (type === "tunkin_only") {
                    const rawTunkin = row["tunkin"] || row["Tunkin"] || row["TUNKIN"] || "0";
                    const tunkinVal = typeof rawTunkin === 'string' ? parseFloat(rawTunkin.replace(/[^0-9.-]+/g, "")) : rawTunkin;

                    const exist = await prisma.member.findFirst({ where: { memberNo: nrpStr } });
                    if (exist) {
                        await prisma.member.update({
                            where: { id: exist.id },
                            data: { tunlesKinerja: tunkinVal }
                        });
                        successCount++;
                    } else {
                        skipCount++;
                    }
                } else if (type === "member_full") {
                    // Full creation/update
                    const rawName = row["nama"] || row["Nama"] || row["NAMA"] || "ANONIM";
                    const rawSalary = row["gaji"] || row["Gaji"] || "0";
                    const rawTunkin = row["tunkin"] || row["Tunkin"] || "0";
                    
                    const salaryVal = typeof rawSalary === 'string' ? parseFloat(rawSalary.replace(/[^0-9.-]+/g, "")) : rawSalary;
                    const tunkinVal = typeof rawTunkin === 'string' ? parseFloat(rawTunkin.replace(/[^0-9.-]+/g, "")) : rawTunkin;

                    const exist = await prisma.member.findFirst({ where: { memberNo: nrpStr } });
                    if (exist) {
                        await prisma.member.update({
                            where: { id: exist.id },
                            data: {
                                name: String(rawName).trim(),
                                salary: salaryVal || 0,
                                tunlesKinerja: tunkinVal || 0
                            }
                        });
                        successCount++;
                    } else {
                        await prisma.member.create({
                             data: {
                                 memberNo: nrpStr,
                                 name: String(rawName).trim(),
                                 branchId: 1, // Default lumajang
                                 salary: salaryVal || 0,
                                 tunlesKinerja: tunkinVal || 0,
                                 joinDate: new Date(),
                                 status: "active"
                             }
                        });
                        successCount++;
                    }
                }
             } catch (err: any) {
                 skipCount++;
                 errors.push(`Row ${i+1} (${nrpStr}): ${err.message}`);
             }
        }

        // Audit Logging
        await prisma.auditLog.create({
            data: {
                action: "IMPORT",
                module: "Anggota",
                description: `Operator mengimport data ${type === "tunkin_only" ? "Tunjangan Kinerja" : "Anggota Baru"}. Berhasil: ${successCount}, Dilewati: ${skipCount}`,
                userId: Number(user.id),
                userName: user.name,
                userRole: user.role,
                status: "success",
            },
        });

        return NextResponse.json({ 
             message: `Proses Selesai. Sukses: ${successCount}, Dilewati/Gagal: ${skipCount}`,
             data: { successCount, skipCount, errors: errors.slice(0, 10) }
        });

    } catch (error: any) {
        console.error("POST /api/mobile/members/import error:", error);
        return NextResponse.json(
            { message: "Gagal memproses import data", error: error.message },
            { status: 500 }
        );
    }
}
