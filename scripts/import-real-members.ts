import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Helper to parse CSV simply (handles basic comma separation)
function parseCSV(filePath: string): Record<string, string>[] {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split(/\r?\n/).filter((line) => line.trim() !== "");
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        // Handle basic split, ignoring commas inside quotes
        const match = lines[i].match(/(?:\"([^\"]*)\"|([^,]+))/g);
        if (!match) continue;
        
        const values = match.map((v) => v.replace(/^"|"$/g, "").trim());
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || "";
        });
        
        data.push(row);
    }
    
    return data;
}

async function main() {
    console.log("🚀 Starting member data import...");

    try {
        // Find Lumajang Branch & Anggota Role
        const branch = await prisma.branch.findFirst({
            where: { code: "LMJ" }
        });

        if (!branch) {
            throw new Error("Branch Lumajang (LMJ) not found! Run seed or fix-branches first.");
        }

        const role = await prisma.role.findFirst({
            where: { name: "anggota" }
        });

        if (!role) {
            throw new Error("Role 'anggota' not found!");
        }

        const basePath = path.join(process.cwd(), "integrasi-akun-asli");
        
        // 1. Process PNS Data
        console.log("📄 Reading PNS data...");
        const pnsFilePath = path.join(basePath, "daftar_gaji_bersih.csv");
        const pnsData = parseCSV(pnsFilePath);
        console.log(`Found ${pnsData.length} PNS records.`);

        // 2. Process Polisi Data
        console.log("📄 Reading Polisi data...");
        const polisiFilePath = path.join(basePath, "daftar_nip_nmpeg_gaji.csv");
        const polisiData = parseCSV(polisiFilePath);
        console.log(`Found ${polisiData.length} Polisi records.`);

        let successCount = 0;
        let skipCount = 0;

        // Unified processing function
        const processRecord = async (nrp: string, name: string, salaryStr: string, category: string) => {
            if (!nrp || !name) return;
            
            // Clean up name (might have quotes or extra spaces)
            const cleanName = name.replace(/^"|"$/g, "").trim();
            const salary = parseFloat(salaryStr || "0");
            
            const existingMember = await prisma.member.findUnique({
                where: { nrp: nrp }
            });

            let memberId;

            if (existingMember) {
                // Update salary and category
                await prisma.member.update({
                    where: { id: existingMember.id },
                    data: { 
                        salary: salary,
                        category: category,
                        name: cleanName
                    }
                });
                memberId = existingMember.id;
            } else {
                // Create complete new member profile
                const formattedMemberNo = `ANG-${nrp}`;
                const newMember = await prisma.member.create({
                    data: {
                        memberNo: formattedMemberNo,
                        nrp: nrp,
                        name: cleanName,
                        category: category,
                        salary: salary,
                        branchId: branch.id,
                        city: "Kabupaten Lumajang",
                        province: "Jawa Timur",
                        joinDate: new Date(),
                        status: "active",
                    }
                });
                memberId = newMember.id;
            }

            // Provision User Account (Login)
            const emailIdentifier = `${nrp}@koperasi.local`;
            const defaultPassword = await bcrypt.hash(nrp, 10);

            const existingUser = await prisma.user.findFirst({
                where: { email: emailIdentifier }
            });

            if (!existingUser) {
                 await prisma.user.create({
                    data: {
                        name: cleanName,
                        email: emailIdentifier,
                        password: defaultPassword,
                        roleId: role.id,
                        branchId: branch.id,
                        memberId: memberId,
                        isActive: true
                    }
                });
                successCount++;
            } else {
                // Ensure password is set to NRP and memberId is linked
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                         password: defaultPassword,
                         memberId: memberId,
                         name: cleanName
                    }
                });
                skipCount++; // Counted as skip/update
            }
        };

        console.log("🔄 Importing PNS accounts...");
        for (let i = 0; i < pnsData.length; i++) {
            const row = pnsData[i];
            await processRecord(row["nip"] || row["nrp"], row["nmpeg"] || row["name"], row["bersih"], "PNS");
            if ((i + 1) % 50 === 0) console.log(`   Processed ${i + 1}/${pnsData.length} PNS...`);
        }

        console.log("🔄 Importing Polisi accounts...");
        for (let i = 0; i < polisiData.length; i++) {
            const row = polisiData[i];
            await processRecord(row["nip"] || row["nrp"], row["nmpeg"] || row["name"], row["gjpokok"], "Polisi");
            if ((i + 1) % 50 === 0) console.log(`   Processed ${i + 1}/${polisiData.length} Polisi...`);
        }

        console.log(`✅ Import completed!`);
        console.log(`   Created new members & users: ${successCount}`);
        console.log(`   Updated existing (skip/update): ${skipCount}`);

    } catch (error) {
        console.error("❌ Import failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
