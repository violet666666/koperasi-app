import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting PNS member import...");

    const csvPath = path.join(__dirname, "../akun pns nama dan gaji bersih.csv");
    const fileContent = fs.readFileSync(csvPath, "utf-8");

    const branch = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
    if (!branch) throw new Error("Branch not found");

    const role = await prisma.role.findFirst({ where: { name: "anggota" } });
    if (!role) throw new Error("Role 'anggota' not found");

    const hashedPassword = await bcrypt.hash("password123", 12);

    const lines = fileContent.split("\n");
    let createdCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let name = "";
        let salaryStr = "";

        // Handle quotes if name contains commas
        if (line.startsWith('"')) {
            const endQuoteIdx = line.indexOf('"', 1);
            if (endQuoteIdx !== -1) {
                name = line.substring(1, endQuoteIdx).trim();
                const afterQuote = line.substring(endQuoteIdx + 1).trim();
                // afterQuote should be something like  ,5.160.300
                if (afterQuote.startsWith(",")) {
                    salaryStr = afterQuote.substring(1).trim();
                }
            }
        } else {
            const parts = line.split(",");
            name = parts[0]?.trim();
            salaryStr = parts[1]?.trim();
        }

        if (!name || !salaryStr) {
            console.log(`Skipping invalid record at row ${i + 1}:`, line);
            continue;
        }

        const salary = Number(salaryStr.replace(/\./g, ""));
        const nrp = `PNS${String(i).padStart(4, "0")}`; // e.g., PNS0001
        
        // Check if member already exists
        const existingMember = await prisma.member.findFirst({
            where: { name }
        });

        if (existingMember) {
            console.log(`⏭️  Skipping existing member: ${name}`);
            continue;
        }

        // Generate unique member no
        const count = await prisma.member.count();
        const memberNo = `MEM-${new Date().getFullYear()}${String(count + 1).padStart(6, "0")}`;

        const member = await prisma.member.create({
            data: {
                memberNo,
                nrp,
                name,
                branchId: branch.id,
                joinDate: new Date(),
                category: "PNS",
                salary,
                status: "active",
            }
        });

        const email = `${nrp.toLowerCase()}@koperasi.com`;
        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                roleId: role.id,
                branchId: branch.id,
                memberId: member.id,
                isActive: true,
            }
        });

        console.log(`✅ Created PNS Member: ${name.padEnd(30)} | NRP: ${nrp} | Salary: ${salaryStr}`);
        createdCount++;
    }

    console.log(`\n🎉 Successfully imported ${createdCount} PNS members.`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
