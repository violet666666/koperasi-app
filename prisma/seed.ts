import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// ======= PERMISSIONS =======
const PERMISSIONS = [
    { name: "manage_all", displayName: "Akses Penuh", module: "system" },
    { name: "user_management", displayName: "Kelola Pengguna", module: "users" },
    { name: "master_data", displayName: "Master Data", module: "master" },
    { name: "manage_anggota", displayName: "Kelola Anggota", module: "members" },
    { name: "view_anggota", displayName: "Lihat Anggota", module: "members" },
    { name: "manage_simpanan", displayName: "Kelola Simpanan", module: "savings" },
    { name: "view_simpanan", displayName: "Lihat Simpanan", module: "savings" },
    { name: "manage_pinjaman", displayName: "Kelola Pinjaman", module: "loans" },
    { name: "view_pinjaman", displayName: "Lihat Pinjaman", module: "loans" },
    { name: "approve_pinjaman", displayName: "Approve Pinjaman", module: "loans" },
    { name: "manage_kas_bank", displayName: "Kelola Kas & Bank", module: "cash_bank" },
    { name: "view_jurnal", displayName: "Lihat Jurnal", module: "accounting" },
    { name: "manage_jurnal", displayName: "Kelola Jurnal", module: "accounting" },
    { name: "view_laporan", displayName: "Lihat Laporan", module: "reports" },
    { name: "tutup_buku", displayName: "Tutup Buku", module: "period" },
    { name: "alokasi_shu", displayName: "Alokasi SHU", module: "shu" },
    { name: "approve_transactions", displayName: "Approve Transaksi", module: "approval" },
    { name: "view_audit_log", displayName: "Lihat Audit Log", module: "audit" },
    { name: "manage_toko", displayName: "Kelola Toko", module: "shop" },
    { name: "manage_pengumuman", displayName: "Kelola Pengumuman", module: "communication" },
    { name: "edit_profil", displayName: "Edit Profil Koperasi", module: "settings" },
    { name: "manage_aset", displayName: "Kelola Aset", module: "assets" },
    { name: "manage_unit_transactions", displayName: "Kelola Transaksi Unit", module: "unit_transactions" },
    { name: "view_own_data", displayName: "Lihat Data Sendiri", module: "portal" },
];

// ======= ROLES =======
const ROLES = [
    {
        name: "operator", displayName: "Operator", description: "Super Admin", isSystem: true,
        permissions: ["manage_all"],
    },
    {
        name: "admin", displayName: "Admin", description: "Admin per unit", isSystem: true,
        permissions: ["manage_anggota", "view_anggota", "manage_simpanan", "view_simpanan", "manage_pinjaman", "view_pinjaman", "approve_pinjaman", "manage_kas_bank", "view_jurnal", "view_laporan", "approve_transactions", "manage_toko", "manage_unit_transactions", "manage_pengumuman"],
    },
    {
        name: "kasir", displayName: "Kasir", description: "Cashier per unit", isSystem: true,
        permissions: ["view_anggota", "manage_simpanan", "view_simpanan", "view_pinjaman", "manage_kas_bank", "manage_toko", "manage_unit_transactions"],
    },
    {
        name: "admin_sp", displayName: "Admin Simpan Pinjam", description: "Admin khusus Simpan Pinjam — akses simpanan, pinjaman, anggota, kas-bank, jurnal, laporan", isSystem: true,
        permissions: ["view_dashboard", "manage_anggota", "view_anggota", "manage_simpanan", "view_simpanan", "manage_pinjaman", "view_pinjaman", "approve_pinjaman", "manage_kas_bank", "view_jurnal", "view_laporan", "approve_transactions", "manage_unit_transactions", "manage_pengumuman"],
    },
    {
        name: "anggota", displayName: "Anggota", description: "Member", isSystem: true,
        permissions: ["view_own_data"],
    },
];

// ======= BRANCHES =======
const BRANCHES = [
    { code: "LMJ", name: "Primkoppol Lumajang", address: "Jl. Alun-Alun Barat No. 10, Lumajang", phone: "0334-551003", email: "lumajang@koperasi.com", isHeadOffice: true, isActive: true },
];

// ======= SAVINGS PRODUCTS =======
const SAVINGS_PRODUCTS = [
    { code: "SP", name: "Simpanan Pokok", type: "pokok", isMandatory: true, depositPeriod: "once", minimumAmount: 100000, canWithdraw: false, isActive: true },
    { code: "SW", name: "Simpanan Wajib", type: "wajib", isMandatory: true, depositPeriod: "monthly", minimumAmount: 50000, canWithdraw: false, isActive: true },
    { code: "SS", name: "Simpanan Sukarela", type: "sukarela", isMandatory: false, depositPeriod: "optional", minimumAmount: 10000, canWithdraw: true, isActive: true },
    { code: "TH", name: "Tabungan Haji", type: "tabungan_haji", isMandatory: false, depositPeriod: "monthly", minimumAmount: 100000, canWithdraw: false, isActive: true, targetAmount: 50000000, adminFeeType: "percent", adminFeeValue: 0.5, linkedBankName: "BSI", allowEarlyWithdraw: false },
    { code: "TU", name: "Tabungan Umrah", type: "tabungan_umrah", isMandatory: false, depositPeriod: "monthly", minimumAmount: 50000, canWithdraw: false, isActive: true, targetAmount: 25000000, adminFeeType: "percent", adminFeeValue: 0.5, linkedBankName: "BSI", allowEarlyWithdraw: false },
];

// ======= LOAN PRODUCTS =======
const LOAN_PRODUCTS = [
    { code: "PR", name: "Pinjaman Reguler", version: 1, interestMethod: "flat", interestRate: 1.0, interestCalculation: "monthly", minTenorMonths: 1, maxTenorMonths: 36, minAmount: 0, maxAmount: 20000000, adminFeeType: "percent", adminFeeValue: 2.0, lateFeeType: "percent_per_day", lateFeeValue: 0.05, gracePeriodDays: 3, requiresCollateral: false, effectiveDate: new Date("2024-01-01"), isCurrent: true, isActive: true, type: "reguler" },
    { code: "PK", name: "Pinjaman Khusus", version: 1, interestMethod: "flat", interestRate: 1.0, interestCalculation: "monthly", minTenorMonths: 1, maxTenorMonths: 60, minAmount: 30000000, maxAmount: null, adminFeeType: "percent", adminFeeValue: 2.0, lateFeeType: "percent_per_day", lateFeeValue: 0.1, gracePeriodDays: 7, requiresCollateral: true, effectiveDate: new Date("2024-01-01"), isCurrent: true, isActive: true, type: "reguler" },
    { code: "TLH", name: "Talangan Haji", version: 1, interestMethod: "flat", interestRate: 0.5, interestCalculation: "monthly", minTenorMonths: 6, maxTenorMonths: 36, minAmount: 1000000, maxAmount: 50000000, adminFeeType: "percent", adminFeeValue: 1.0, lateFeeType: "percent_per_day", lateFeeValue: 0.05, gracePeriodDays: 3, requiresCollateral: false, effectiveDate: new Date("2024-01-01"), isCurrent: true, isActive: true, type: "talangan_haji" },
    { code: "TLU", name: "Talangan Umrah", version: 1, interestMethod: "flat", interestRate: 0.5, interestCalculation: "monthly", minTenorMonths: 3, maxTenorMonths: 24, minAmount: 500000, maxAmount: 25000000, adminFeeType: "percent", adminFeeValue: 1.0, lateFeeType: "percent_per_day", lateFeeValue: 0.05, gracePeriodDays: 3, requiresCollateral: false, effectiveDate: new Date("2024-01-01"), isCurrent: true, isActive: true, type: "talangan_umrah" },
];

// ======= CHART OF ACCOUNTS (CoA) =======
const COA = [
    // ASSETS
    { code: "1000", name: "Aset", type: "asset", level: 1, isDetail: false, normalBalance: "debit", category: "asset" },
    { code: "1100", name: "Kas & Bank", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "current_asset" },
    { code: "1101", name: "Kas Besar", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1102", name: "Kas Kecil", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1103", name: "Bank BRI", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1104", name: "Bank BCA", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1200", name: "Piutang", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "current_asset" },
    { code: "1201", name: "Piutang Pinjaman Anggota", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1200", category: "current_asset" },
    { code: "1202", name: "Piutang Bunga Pinjaman", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1200", category: "current_asset" },
    { code: "1300", name: "Persediaan", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "current_asset" },
    { code: "1301", name: "Persediaan Barang Dagangan", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1300", category: "current_asset" },
    { code: "1400", name: "Aset Tetap", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "fixed_asset" },
    { code: "1401", name: "Peralatan Kantor", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1400", category: "fixed_asset" },
    { code: "1402", name: "Kendaraan", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1400", category: "fixed_asset" },
    { code: "1403", name: "Akumulasi Penyusutan", type: "asset", level: 3, isDetail: true, normalBalance: "credit", parentCode: "1400", category: "fixed_asset" },

    // LIABILITIES
    { code: "2000", name: "Kewajiban", type: "liability", level: 1, isDetail: false, normalBalance: "credit", category: "liability" },
    { code: "2100", name: "Simpanan Anggota", type: "liability", level: 2, isDetail: false, normalBalance: "credit", parentCode: "2000", category: "current_liability" },
    { code: "2101", name: "Simpanan Pokok", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    { code: "2102", name: "Simpanan Wajib", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    { code: "2103", name: "Simpanan Sukarela", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    { code: "2200", name: "Hutang Lainnya", type: "liability", level: 2, isDetail: false, normalBalance: "credit", parentCode: "2000", category: "current_liability" },
    { code: "2201", name: "Hutang Usaha", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2200", category: "current_liability" },

    // EQUITY
    { code: "3000", name: "Modal", type: "equity", level: 1, isDetail: false, normalBalance: "credit", category: "equity" },
    { code: "3101", name: "Modal Disetor", type: "equity", level: 2, isDetail: true, normalBalance: "credit", parentCode: "3000", category: "equity" },
    { code: "3102", name: "Cadangan Umum", type: "equity", level: 2, isDetail: true, normalBalance: "credit", parentCode: "3000", category: "equity" },
    { code: "3103", name: "SHU Tahun Berjalan", type: "equity", level: 2, isDetail: true, normalBalance: "credit", parentCode: "3000", category: "equity" },

    // INCOME
    { code: "4000", name: "Pendapatan", type: "income", level: 1, isDetail: false, normalBalance: "credit", category: "income" },
    { code: "4101", name: "Pendapatan Bunga Pinjaman", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4102", name: "Pendapatan Admin Pinjaman", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4103", name: "Pendapatan Denda Keterlambatan", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4201", name: "Pendapatan Toko", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4202", name: "Pendapatan Unit Fotocopy", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4203", name: "Pendapatan Unit Cuci Mobil", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4204", name: "Pendapatan Unit Fitness", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4301", name: "Pendapatan Lain-lain", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },

    // EXPENSE
    { code: "5000", name: "Beban", type: "expense", level: 1, isDetail: false, normalBalance: "debit", category: "expense" },
    { code: "5101", name: "Beban Gaji & Tunjangan", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5102", name: "Beban Sewa", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5103", name: "Beban Listrik & Air", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5104", name: "Beban ATK", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5105", name: "Beban Penyusutan", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5106", name: "Beban Operasional Lainnya", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
    { code: "5201", name: "Beban Pokok Toko", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" },
];

function parseCSV(filePath: string) {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    // Simple CSV parser that handles quotes properly
    return lines.slice(1).map(line => {
        const values: string[] = [];
        let curVal = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(curVal.trim());
                curVal = '';
            } else {
                curVal += char;
            }
        }
        values.push(curVal.trim());
        return values;
    });
}

async function main() {
    console.log("🌱 Starting seed with real data...\n");

    // ----- Clean existing data (reverse dependency order) -----
    console.log("🧹 Cleaning existing data...");
    await prisma.storeSaleItem.deleteMany();
    await prisma.storeSale.deleteMany();
    await prisma.storeProduct.deleteMany();
    await prisma.loanPaymentAllocation.deleteMany();
    await prisma.loanPayment.deleteMany();
    await prisma.loanSchedule.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.loanApplication.deleteMany();
    await prisma.unitTransaction.deleteMany();
    await prisma.savingsTransaction.deleteMany();
    await prisma.savingsAccount.deleteMany();
    await prisma.cashBankTransaction.deleteMany();
    await prisma.journalLine.deleteMany();
    await prisma.journal.deleteMany();
    await prisma.cashBankAccount.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.receipt.deleteMany();
    await prisma.user.deleteMany();
    await prisma.member.deleteMany();
    await prisma.fiscalPeriod.deleteMany();
    await prisma.account.deleteMany();
    await prisma.savingsProduct.deleteMany();
    await prisma.loanProduct.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.role.deleteMany();
    console.log("   ✓ Data cleaned\n");

    // ----- Permissions & Roles -----
    console.log("🔑 Creating permissions and roles...");
    for (const perm of PERMISSIONS) {
        await prisma.permission.create({ data: perm });
    }
    const roleMap: Record<string, number> = {};
    for (const role of ROLES) {
        const { permissions, ...roleData } = role;
        const created = await prisma.role.create({ data: roleData });
        roleMap[role.name] = created.id;
        for (const permName of permissions) {
            const perm = await prisma.permission.findUnique({ where: { name: permName } });
            if (perm) {
                await prisma.rolePermission.create({ data: { roleId: created.id, permissionId: perm.id } });
            }
        }
    }

    // ----- Branches -----
    console.log("🏢 Creating branches...");
    const branchMap: Record<string, number> = {};
    for (const branch of BRANCHES) {
        const created = await prisma.branch.create({ data: branch });
        branchMap[branch.code] = created.id;
    }
    const branchId = branchMap["LMJ"];

    // ----- CoA & Products -----
    console.log("📊 Creating Chart of Accounts and Products...");
    const accountMap: Record<string, number> = {};
    for (const acc of COA) {
        const { parentCode, ...data } = acc as any;
        const created = await prisma.account.create({ data });
        accountMap[acc.code] = created.id;
    }
    for (const acc of COA) {
        const { parentCode } = acc as any;
        if (parentCode && accountMap[parentCode]) {
            await prisma.account.update({
                where: { id: accountMap[acc.code] },
                data: { parentId: accountMap[parentCode] },
            });
        }
    }

    const spGlMap: Record<string, string> = { SP: "2101", SW: "2102", SS: "2103", TH: "2103", TU: "2103" };
    for (const product of SAVINGS_PRODUCTS) {
        const glAccountId = accountMap[spGlMap[product.code]] || null;
        await prisma.savingsProduct.create({ data: { ...product, glAccountId } });
    }
    for (const product of LOAN_PRODUCTS) {
        await prisma.loanProduct.create({ data: product });
    }

    // ----- Core Accounts -----
    console.log("💵 Creating cash & bank accounts & fiscal periods...");
    const cashBankMap: Record<string, number> = {};
    const cashBankAccounts = [
        { code: "KAS-01", name: "Kas Besar", type: "cash", branchId, glAccountId: accountMap["1101"], currentBalance: 50000000 },
        { code: "KAS-02", name: "Kas Kecil", type: "cash", branchId, glAccountId: accountMap["1102"], currentBalance: 5000000 },
        { code: "BRI-01", name: "Bank BRI - Giro", type: "bank", bankName: "BRI", accountNumber: "001201003456789", branchId, glAccountId: accountMap["1103"], currentBalance: 150000000 },
        { code: "BCA-01", name: "Bank BCA - Giro", type: "bank", bankName: "BCA", accountNumber: "1234567890", branchId, glAccountId: accountMap["1104"], currentBalance: 100000000 },
    ];
    for (const cba of cashBankAccounts) {
        const created = await prisma.cashBankAccount.create({ data: cba });
        cashBankMap[cba.code] = created.id;
    }

    for (let m = 1; m <= 3; m++) {
        const start = new Date(2026, m - 1, 1);
        const end = new Date(2026, m, 0);
        const names = ["Januari", "Februari", "Maret"];
        await prisma.fiscalPeriod.create({
            data: {
                name: `${names[m - 1]} 2026`, year: 2026, month: m,
                startDate: start, endDate: end,
                status: m === 3 ? "open" : "closed",
                closedAt: m < 3 ? end : null,
            },
        });
    }

    // ----- Admins & Operators -----
    console.log("👨‍💼 Creating admin, operator, and kasir accounts...");
    const defaultPassword = await bcrypt.hash("password123", 10);
    
    // Operator
    await prisma.user.create({
        data: {
            name: "Operator (Super Admin)",
            email: "operator@koperasi.com",
            password: defaultPassword,
            roleId: roleMap["operator"],
            branchId,
            isActive: true,
        },
    });

    // Admin Simpan Pinjam
    if (roleMap["admin_sp"]) {
        await prisma.user.create({
            data: {
                name: "Admin Simpan Pinjam",
                email: "adminsp@koperasi.com",
                password: defaultPassword,
                roleId: roleMap["admin_sp"],
                branchId,
                unitType: "simpan_pinjam",
                isActive: true,
            },
        });
    }

    const UNIT_STAFF = [
        { unit: "simpan_pinjam", label: "Simpan Pinjam", emailKey: "sp" },
        { unit: "toko", label: "Toko", emailKey: "toko" },
        { unit: "fitness", label: "Fitness", emailKey: "fitness" },
        { unit: "cuci_mobil", label: "Cuci Mobil", emailKey: "cucimobil" },
        { unit: "fotocopy", label: "Fotocopy", emailKey: "fotocopy" },
        { unit: "laundry", label: "Laundry", emailKey: "laundry" },
        { unit: "resto_cafe", label: "Resto & Cafe", emailKey: "cafe" },
        { unit: "playstation", label: "Playstation", emailKey: "ps" },
        { unit: "barbershop", label: "Barbershop", emailKey: "barbershop" },
        { unit: "cafe_lsp", label: "Cafe LSP", emailKey: "cafelsp" },
        { unit: "aset", label: "Aset", emailKey: "aset" },
    ];

    for (const us of UNIT_STAFF) {
        await prisma.user.create({
            data: {
                name: `Admin ${us.label}`, email: `admin${us.emailKey}@koperasi.com`,
                password: defaultPassword, roleId: roleMap["admin"], branchId, unitType: us.unit, isActive: true,
            },
        });
        await prisma.user.create({
            data: {
                name: `Kasir ${us.label}`, email: `kasir${us.emailKey}@koperasi.com`,
                password: defaultPassword, roleId: roleMap["kasir"], branchId, unitType: us.unit, isActive: true,
            },
        });
    }

    // ----- Members via CSV Import -----
    console.log("👥 Importing members from CSV...");
    
    // Parse PNS
    const pnsPath = path.join(process.cwd(), 'integrasi-akun-asli', 'daftar_gaji_bersih.csv');
    const pnsData = parseCSV(pnsPath);
    
    // Parse Polri
    const polriPath = path.join(process.cwd(), 'integrasi-akun-asli', 'daftar_nip_nmpeg_gaji.csv');
    const polriData = parseCSV(polriPath);

    const membersToCreate: any[] = [];

    // Process PNS (nip,nmpeg,bersih)
    for(const row of pnsData) {
        if(row.length < 3) continue;
        const nrp = row[0];
        const name = row[1];
        const salary = Number(row[2]) || 0;
        
        // Skip identical nrp (prevent dups)
        if(membersToCreate.find(m => m.nrp === nrp)) continue;

        membersToCreate.push({
            nrp, name, salary, category: "PNS", city: "Kabupaten Lumajang"
        });
    }

    // Process Polri (no,nip,nmpeg,gjpokok)
    for(const row of polriData) {
        if(row.length < 4) continue;
        const nrp = row[1];
        const name = row[2];
        const salary = Number(row[3]) || 0;

        if(membersToCreate.find(m => m.nrp === nrp)) continue;

        membersToCreate.push({
            nrp, name, salary, category: "Polri", city: "Kabupaten Lumajang"
        });
    }

    console.log(`Found ${membersToCreate.length} members to import.`);
    
    let createdCount = 0;
    
    for (const m of membersToCreate) {
        // Fast hashing for large batches
        const memberHash = await bcrypt.hash(m.nrp, 10);

        const member = await prisma.member.create({
            data: {
                memberNo: m.nrp, // The user strictly wants NIP/NRP numbers, no "MBR-" prefix
                nrp: m.nrp, 
                name: m.name, 
                salary: m.salary,
                category: m.category,
                city: m.city,
                joinDate: new Date(),
                branchId,
                status: "active"
            }
        });

        await prisma.user.create({
            data: {
                name: m.name,
                email: `${m.nrp}@koperasi.local`, // Optional fallback structure if email is required
                password: memberHash,
                roleId: roleMap["anggota"],
                branchId,
                memberId: member.id,
                isActive: true
            }
        });

        createdCount++;
        if(createdCount % 50 === 0) {
            console.log(`Imported ${createdCount}/${membersToCreate.length} members...`);
        }
    }

    console.log(`✅ successfully imported ${createdCount} members with their accounts (NRP + NRP password).`);
    console.log("🎉 Seed finished successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
