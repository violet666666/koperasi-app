/**
 * Import real member accounts from CSV
 * 
 * Usage: npx tsx prisma/import-members.ts
 * 
 * Reads: integrasi-akun-asli/daftar_nip_nmpeg_gaji.csv
 * Creates: Member records + User accounts (login with NIP@koperasi.local / password123)
 */

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function parseCSV(content: string): { nip: string; name: string; salary: number }[] {
    const lines = content.trim().split(/\r?\n/);
    const results: { nip: string; name: string; salary: number }[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV with quoted fields (names may contain commas)
        const parts: string[] = [];
        let current = "";
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        parts.push(current.trim());

        // parts: [no, nip, nmpeg, gjpokok]
        if (parts.length >= 4) {
            const nip = parts[1];
            const name = parts[2];
            const salary = parseInt(parts[3], 10);

            if (nip && name && !isNaN(salary)) {
                results.push({ nip, name, salary });
            }
        }
    }

    return results;
}

async function main() {
    console.log("🔄 Starting member import from CSV...\n");

    // Read CSV
    const csvPath = path.resolve(__dirname, "../integrasi-akun-asli/daftar_nip_nmpeg_gaji.csv");
    if (!fs.existsSync(csvPath)) {
        console.error("❌ CSV file not found:", csvPath);
        process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const members = parseCSV(csvContent);
    console.log(`📋 Found ${members.length} members in CSV\n`);

    // Get role for anggota
    const anggotaRole = await prisma.role.findFirst({ where: { name: "anggota" } });
    if (!anggotaRole) {
        console.error("❌ Role 'anggota' not found. Run 'npx prisma db seed' first.");
        process.exit(1);
    }

    // Get default branch (HO)
    const defaultBranch = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
    if (!defaultBranch) {
        console.error("❌ Head Office branch not found. Run 'npx prisma db seed' first.");
        process.exit(1);
    }

    // Hash password once
    const hashedPassword = await bcrypt.hash("password123", 12);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const memberNo = `MBR-${String(i + 1).padStart(5, "0")}`;
        const email = `${m.nip}@koperasi.local`;

        try {
            // Check if NRP/NIP already exists
            const existing = await prisma.member.findFirst({
                where: { OR: [{ nrp: m.nip }, { email: m.nip }] },
            });

            if (existing) {
                skipped++;
                continue;
            }

            // Also check if user email already exists
            const existingUser = await prisma.user.findFirst({
                where: { email },
            });

            if (existingUser) {
                skipped++;
                continue;
            }

            // Create member
            const member = await prisma.member.create({
                data: {
                    memberNo,
                    nrp: m.nip,
                    name: m.name,
                    branchId: defaultBranch.id,
                    joinDate: new Date(),
                    status: "active",
                    category: "Polri",
                    salary: m.salary,
                },
            });

            // Create user account for portal login
            await prisma.user.create({
                data: {
                    name: m.name,
                    email,
                    password: hashedPassword,
                    roleId: anggotaRole.id,
                    branchId: defaultBranch.id,
                    memberId: member.id,
                    isActive: true,
                },
            });

            created++;

            // Progress indicator
            if ((i + 1) % 50 === 0) {
                console.log(`  ⏳ Progress: ${i + 1}/${members.length} (${created} created, ${skipped} skipped)`);
            }
        } catch (error: any) {
            errors++;
            console.error(`  ❌ Error for NIP ${m.nip} (${m.name}): ${error.message}`);
        }
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("              IMPORT SELESAI                       ");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  ✅ Berhasil dibuat : ${created} anggota`);
    console.log(`  ⏭️  Dilewati (sudah ada) : ${skipped} anggota`);
    console.log(`  ❌ Error : ${errors} anggota`);
    console.log(`  📊 Total dalam CSV : ${members.length} anggota`);
    console.log("");
    console.log("  Login: NIP@koperasi.local / password123");
    console.log("═══════════════════════════════════════════════════\n");
}

main()
    .catch((e) => {
        console.error("❌ Import error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
