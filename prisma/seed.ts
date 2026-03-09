import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ======= PERMISSIONS =======
const PERMISSIONS = [
    // System
    { name: "manage_all", displayName: "Akses Penuh", module: "system" },
    { name: "user_management", displayName: "Kelola Pengguna", module: "users" },
    { name: "master_data", displayName: "Master Data", module: "master" },
    // Members
    { name: "manage_anggota", displayName: "Kelola Anggota", module: "members" },
    { name: "view_anggota", displayName: "Lihat Anggota", module: "members" },
    // Savings
    { name: "manage_simpanan", displayName: "Kelola Simpanan", module: "savings" },
    { name: "view_simpanan", displayName: "Lihat Simpanan", module: "savings" },
    // Loans
    { name: "manage_pinjaman", displayName: "Kelola Pinjaman", module: "loans" },
    { name: "view_pinjaman", displayName: "Lihat Pinjaman", module: "loans" },
    { name: "approve_pinjaman", displayName: "Approve Pinjaman", module: "loans" },
    // Cash & Bank
    { name: "manage_kas_bank", displayName: "Kelola Kas & Bank", module: "cash_bank" },
    // Accounting
    { name: "view_jurnal", displayName: "Lihat Jurnal", module: "accounting" },
    { name: "manage_jurnal", displayName: "Kelola Jurnal", module: "accounting" },
    { name: "view_laporan", displayName: "Lihat Laporan", module: "reports" },
    { name: "tutup_buku", displayName: "Tutup Buku", module: "period" },
    { name: "alokasi_shu", displayName: "Alokasi SHU", module: "shu" },
    // Approval & Audit
    { name: "approve_transactions", displayName: "Approve Transaksi", module: "approval" },
    { name: "view_audit_log", displayName: "Lihat Audit Log", module: "audit" },
    // Shop & Units
    { name: "manage_toko", displayName: "Kelola Toko", module: "shop" },
    { name: "manage_pengumuman", displayName: "Kelola Pengumuman", module: "communication" },
    { name: "edit_profil", displayName: "Edit Profil Koperasi", module: "settings" },
    { name: "manage_aset", displayName: "Kelola Aset", module: "assets" },
    { name: "manage_unit_transactions", displayName: "Kelola Transaksi Unit", module: "unit_transactions" },
    // Portal
    { name: "view_own_data", displayName: "Lihat Data Sendiri", module: "portal" },
];

// ======= ROLES (4-tier RBAC) =======
const ROLES = [
    {
        name: "operator", displayName: "Operator", description: "Super Admin – full access to all features and all units", isSystem: true,
        permissions: ["manage_all"],
    },
    {
        name: "admin", displayName: "Admin", description: "Admin per unit – manages operations for their assigned unit", isSystem: true,
        permissions: ["manage_anggota", "view_anggota", "manage_simpanan", "view_simpanan", "manage_pinjaman", "view_pinjaman", "approve_pinjaman", "manage_kas_bank", "view_jurnal", "view_laporan", "approve_transactions", "manage_toko", "manage_unit_transactions", "manage_pengumuman"],
    },
    {
        name: "kasir", displayName: "Kasir", description: "Cashier per unit – can only input transactions for their assigned unit", isSystem: true,
        permissions: ["view_anggota", "manage_simpanan", "view_simpanan", "view_pinjaman", "manage_kas_bank", "manage_toko", "manage_unit_transactions"],
    },
    {
        name: "anggota", displayName: "Anggota", description: "Member – portal access to view own data and submit loan applications", isSystem: true,
        permissions: ["view_own_data"],
    },
];

// ======= BRANCHES (East Java) =======
const BRANCHES = [
    { code: "HO", name: "Kantor Pusat Surabaya", address: "Jl. Tunjungan No. 1, Surabaya", phone: "031-5551000", email: "pusat@koperasi.com", isHeadOffice: true, isActive: true },
    { code: "JBR", name: "Cabang Jember", address: "Jl. PB Sudirman No. 45, Jember", phone: "0331-551001", email: "jember@koperasi.com", isHeadOffice: false, isActive: true },
    { code: "MLG", name: "Cabang Malang", address: "Jl. Ijen No. 20, Malang", phone: "0341-551002", email: "malang@koperasi.com", isHeadOffice: false, isActive: true },
    { code: "LMJ", name: "Cabang Lumajang", address: "Jl. Alun-Alun Barat No. 10, Lumajang", phone: "0334-551003", email: "lumajang@koperasi.com", isHeadOffice: false, isActive: true },
    { code: "KDR", name: "Cabang Kediri", address: "Jl. Dhoho No. 55, Kediri", phone: "0354-551004", email: "kediri@koperasi.com", isHeadOffice: false, isActive: true },
    { code: "BWI", name: "Cabang Banyuwangi", address: "Jl. A. Yani No. 30, Banyuwangi", phone: "0333-551005", email: "banyuwangi@koperasi.com", isHeadOffice: false, isActive: true },
];

// ======= SAVINGS PRODUCTS =======
const SAVINGS_PRODUCTS = [
    { code: "SP", name: "Simpanan Pokok", type: "pokok", isMandatory: true, depositPeriod: "once", minimumAmount: 100000, canWithdraw: false, isActive: true },
    { code: "SW", name: "Simpanan Wajib", type: "wajib", isMandatory: true, depositPeriod: "monthly", minimumAmount: 50000, canWithdraw: false, isActive: true },
    { code: "SS", name: "Simpanan Sukarela", type: "sukarela", isMandatory: false, depositPeriod: "optional", minimumAmount: 10000, canWithdraw: true, isActive: true },
];

// ======= LOAN PRODUCTS =======
const LOAN_PRODUCTS = [
    { code: "PR", name: "Pinjaman Reguler", version: 1, interestMethod: "flat", interestRate: 12.0, interestCalculation: "monthly", minTenorMonths: 3, maxTenorMonths: 24, minAmount: 1000000, maxAmount: 50000000, adminFeeType: "percent", adminFeeValue: 1.0, lateFeeType: "percent_per_day", lateFeeValue: 0.05, gracePeriodDays: 3, requiresCollateral: false, effectiveDate: new Date("2025-01-01"), isCurrent: true, isActive: true },
    { code: "PK", name: "Pinjaman Khusus", version: 1, interestMethod: "flat", interestRate: 10.0, interestCalculation: "monthly", minTenorMonths: 6, maxTenorMonths: 36, minAmount: 5000000, maxAmount: 100000000, adminFeeType: "percent", adminFeeValue: 1.5, lateFeeType: "percent_per_day", lateFeeValue: 0.1, gracePeriodDays: 7, requiresCollateral: true, effectiveDate: new Date("2025-01-01"), isCurrent: true, isActive: true },
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

// ======= 10 DUMMY MEMBERS =======
const MEMBERS_DATA = [
    { nrp: "78120001", name: "Agus Setiawan", nik: "3509010101850001", gender: "male", birthPlace: "Surabaya", birthDate: "1985-01-15", maritalStatus: "married", religion: "islam", education: "s1", occupation: "Polisi", phone: "081234000001", email: "agus@email.com", address: "Jl. Raya Darmo No. 12", city: "Surabaya", province: "Jawa Timur", postalCode: "60241", branchCode: "HO" },
    { nrp: "78120002", name: "Siti Rahayu", nik: "3509020202870002", gender: "female", birthPlace: "Jember", birthDate: "1987-06-20", maritalStatus: "married", religion: "islam", education: "s1", occupation: "Polisi", phone: "081234000002", email: "siti@email.com", address: "Jl. Kalimantan No. 5", city: "Jember", province: "Jawa Timur", postalCode: "68121", branchCode: "JBR" },
    { nrp: "78120003", name: "Bambang Widodo", nik: "3509030303900003", gender: "male", birthPlace: "Malang", birthDate: "1990-03-10", maritalStatus: "single", religion: "islam", education: "sma", occupation: "Polisi", phone: "081234000003", email: "bambang@email.com", address: "Jl. Ijen No. 45", city: "Malang", province: "Jawa Timur", postalCode: "65119", branchCode: "MLG" },
    { nrp: "78120004", name: "Dewi Lestari", nik: "3509040404880004", gender: "female", birthPlace: "Lumajang", birthDate: "1988-11-25", maritalStatus: "married", religion: "islam", education: "d3", occupation: "Polisi", phone: "081234000004", email: "dewi@email.com", address: "Jl. Diponegoro No. 78", city: "Lumajang", province: "Jawa Timur", postalCode: "67311", branchCode: "LMJ" },
    { nrp: "78120005", name: "Eko Prasetyo", nik: "3509050505920005", gender: "male", birthPlace: "Kediri", birthDate: "1992-07-30", maritalStatus: "single", religion: "islam", education: "s1", occupation: "Polisi", phone: "081234000005", email: "eko@email.com", address: "Jl. Dhoho No. 33", city: "Kediri", province: "Jawa Timur", postalCode: "64123", branchCode: "KDR" },
    { nrp: "78120006", name: "Fitri Handayani", nik: "3509060606860006", gender: "female", birthPlace: "Banyuwangi", birthDate: "1986-09-12", maritalStatus: "married", religion: "islam", education: "s1", occupation: "Polisi", phone: "081234000006", email: "fitri@email.com", address: "Jl. A. Yani No. 15", city: "Banyuwangi", province: "Jawa Timur", postalCode: "68416", branchCode: "BWI" },
    { nrp: "78120007", name: "Gunawan Saputra", nik: "3509070707910007", gender: "male", birthPlace: "Surabaya", birthDate: "1991-04-05", maritalStatus: "married", religion: "kristen", education: "s2", occupation: "Polisi", phone: "081234000007", email: "gunawan@email.com", address: "Jl. Pemuda No. 50", city: "Surabaya", province: "Jawa Timur", postalCode: "60271", branchCode: "HO" },
    { nrp: "78120008", name: "Heni Kusuma", nik: "3509080808890008", gender: "female", birthPlace: "Jember", birthDate: "1989-12-18", maritalStatus: "single", religion: "islam", education: "s1", occupation: "Polisi", phone: "081234000008", email: "heni@email.com", address: "Jl. Gajah Mada No. 22", city: "Jember", province: "Jawa Timur", postalCode: "68131", branchCode: "JBR" },
    { nrp: "78120009", name: "Irfan Maulana", nik: "3509090909930009", gender: "male", birthPlace: "Malang", birthDate: "1993-08-22", maritalStatus: "single", religion: "islam", education: "sma", occupation: "Polisi", phone: "081234000009", email: "irfan@email.com", address: "Jl. Veteran No. 88", city: "Malang", province: "Jawa Timur", postalCode: "65145", branchCode: "MLG" },
    { nrp: "78120010", name: "Julia Puspita", nik: "3509101010870010", gender: "female", birthPlace: "Kediri", birthDate: "1987-02-14", maritalStatus: "married", religion: "hindu", education: "s1", occupation: "Polisi", phone: "081234000010", email: "julia@email.com", address: "Jl. Brawijaya No. 60", city: "Kediri", province: "Jawa Timur", postalCode: "64114", branchCode: "KDR" },
];

// ===================== MAIN SEED =====================
async function main() {
    console.log("🌱 Starting comprehensive demo seed...\n");

    // ----- Clean existing data (reverse dependency order) -----
    console.log("🧹 Cleaning existing data...");
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

    // ----- Permissions -----
    console.log("🔑 Creating permissions...");
    for (const perm of PERMISSIONS) {
        await prisma.permission.create({ data: perm });
    }

    // ----- Roles -----
    console.log("👤 Creating roles...");
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
    console.log("🏢 Creating East Java branches...");
    const branchMap: Record<string, number> = {};
    for (const branch of BRANCHES) {
        const created = await prisma.branch.create({ data: branch });
        branchMap[branch.code] = created.id;
    }

    // ----- Chart of Accounts -----
    console.log("📊 Creating Chart of Accounts...");
    const accountMap: Record<string, number> = {};
    // First pass: create all accounts without parent
    for (const acc of COA) {
        const { parentCode, ...data } = acc as any;
        const created = await prisma.account.create({ data });
        accountMap[acc.code] = created.id;
    }
    // Second pass: set parent references
    for (const acc of COA) {
        const { parentCode } = acc as any;
        if (parentCode && accountMap[parentCode]) {
            await prisma.account.update({
                where: { id: accountMap[acc.code] },
                data: { parentId: accountMap[parentCode] },
            });
        }
    }

    // Link savings products to GL accounts
    console.log("💰 Creating savings products...");
    const savingsProductMap: Record<string, number> = {};
    const spGlMap: Record<string, string> = { SP: "2101", SW: "2102", SS: "2103" };
    for (const product of SAVINGS_PRODUCTS) {
        const glAccountId = accountMap[spGlMap[product.code]] || null;
        const created = await prisma.savingsProduct.create({ data: { ...product, glAccountId } });
        savingsProductMap[product.code] = created.id;
    }

    // ----- Loan Products -----
    console.log("🏦 Creating loan products...");
    const loanProductMap: Record<string, number> = {};
    for (const product of LOAN_PRODUCTS) {
        const created = await prisma.loanProduct.create({ data: product });
        loanProductMap[product.code] = created.id;
    }

    // ----- Cash & Bank Accounts -----
    console.log("💵 Creating cash & bank accounts...");
    const cashBankMap: Record<string, number> = {};
    const cashBankAccounts = [
        { code: "KAS-01", name: "Kas Besar", type: "cash", branchId: branchMap["HO"], glAccountId: accountMap["1101"], currentBalance: 50000000 },
        { code: "KAS-02", name: "Kas Kecil", type: "cash", branchId: branchMap["HO"], glAccountId: accountMap["1102"], currentBalance: 5000000 },
        { code: "BRI-01", name: "Bank BRI - Giro", type: "bank", bankName: "BRI", accountNumber: "001201003456789", branchId: branchMap["HO"], glAccountId: accountMap["1103"], currentBalance: 150000000 },
        { code: "BCA-01", name: "Bank BCA - Giro", type: "bank", bankName: "BCA", accountNumber: "1234567890", branchId: branchMap["HO"], glAccountId: accountMap["1104"], currentBalance: 100000000 },
    ];
    for (const cba of cashBankAccounts) {
        const created = await prisma.cashBankAccount.create({ data: cba });
        cashBankMap[cba.code] = created.id;
    }

    // ----- Fiscal Periods (Jan-Mar 2026) -----
    console.log("📅 Creating fiscal periods...");
    const periodMap: Record<number, number> = {};
    for (let m = 1; m <= 3; m++) {
        const start = new Date(2026, m - 1, 1);
        const end = new Date(2026, m, 0);
        const names = ["Januari", "Februari", "Maret"];
        const created = await prisma.fiscalPeriod.create({
            data: {
                name: `${names[m - 1]} 2026`,
                year: 2026,
                month: m,
                startDate: start,
                endDate: end,
                status: m === 3 ? "open" : "closed",
                closedAt: m < 3 ? end : null,
            },
        });
        periodMap[m] = created.id;
    }

    // ----- Admin User (Operator = Super Admin) -----
    console.log("👨‍💼 Creating operator + demo staff accounts...");
    const hashedPassword = await bcrypt.hash("password123", 12);
    const adminUser = await prisma.user.create({
        data: {
            name: "Operator (Super Admin)",
            email: "admin@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["operator"],
            branchId: branchMap["HO"],
            isActive: true,
        },
    });

    // Admin Simpan Pinjam
    await prisma.user.create({
        data: {
            name: "Admin Simpan Pinjam",
            email: "admin.sp@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["admin"],
            branchId: branchMap["HO"],
            unitType: "simpan_pinjam",
            isActive: true,
        },
    });

    // Admin Toko
    await prisma.user.create({
        data: {
            name: "Admin Toko",
            email: "admin.toko@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["admin"],
            branchId: branchMap["HO"],
            unitType: "toko",
            isActive: true,
        },
    });

    // Kasir Simpan Pinjam
    await prisma.user.create({
        data: {
            name: "Kasir Simpan Pinjam",
            email: "kasir.sp@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["kasir"],
            branchId: branchMap["HO"],
            unitType: "simpan_pinjam",
            isActive: true,
        },
    });

    // Kasir Toko
    await prisma.user.create({
        data: {
            name: "Kasir Toko",
            email: "kasir.toko@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["kasir"],
            branchId: branchMap["HO"],
            unitType: "toko",
            isActive: true,
        },
    });

    // Admin Fitness
    await prisma.user.create({
        data: {
            name: "Admin Fitness",
            email: "admin.fitness@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["admin"],
            branchId: branchMap["HO"],
            unitType: "fitness",
            isActive: true,
        },
    });

    // Kasir Fitness
    await prisma.user.create({
        data: {
            name: "Kasir Fitness",
            email: "kasir.fitness@koperasi.com",
            password: hashedPassword,
            roleId: roleMap["kasir"],
            branchId: branchMap["HO"],
            unitType: "fitness",
            isActive: true,
        },
    });

    // ----- Members + User Accounts -----
    console.log("👥 Creating 10 dummy members...");
    const memberIds: number[] = [];
    const memberBranchIds: number[] = [];

    for (let i = 0; i < MEMBERS_DATA.length; i++) {
        const m = MEMBERS_DATA[i];
        const branchId = branchMap[m.branchCode];
        const memberNo = `MBR-2026${String(i + 1).padStart(4, "0")}`;
        const joinDate = new Date(2026, 0, 5 + i); // staggered join dates in January 2026

        const salaries = [5500000, 4800000, 6200000, 4500000, 5000000, 5300000, 7000000, 4700000, 5800000, 5100000];
        const categories = ["Polri", "PNS", "Polri", "Karyawan", "Polri", "PNS", "Polri", "Karyawan", "Polri", "PNS"];

        const member = await prisma.member.create({
            data: {
                memberNo, nrp: m.nrp, name: m.name, nik: m.nik, gender: m.gender,
                birthPlace: m.birthPlace, birthDate: new Date(m.birthDate),
                maritalStatus: m.maritalStatus, religion: m.religion, education: m.education,
                occupation: m.occupation, phone: m.phone, email: m.email,
                address: m.address, city: m.city, province: m.province, postalCode: m.postalCode,
                branchId, joinDate, status: "active", category: categories[i], salary: salaries[i], createdById: adminUser.id,
            },
        });
        memberIds.push(member.id);
        memberBranchIds.push(branchId);

        // Create user account for member portal login
        await prisma.user.create({
            data: {
                name: m.name,
                email: `${m.nrp}@koperasi.local`,
                password: hashedPassword,
                roleId: roleMap["anggota"],
                branchId,
                memberId: member.id,
                isActive: true,
            },
        });
    }

    // ----- Helper: Create Journal -----
    let journalSeq = 0;
    async function createJournal(opts: { branchId: number; date: Date; description: string; periodId: number; lines: { accountCode: string; debit: number; credit: number; desc?: string }[]; sourceType?: string; sourceId?: number }) {
        journalSeq++;
        const journal = await prisma.journal.create({
            data: {
                journalNo: `JRN-2026${String(journalSeq).padStart(5, "0")}`,
                branchId: opts.branchId,
                transactionDate: opts.date,
                description: opts.description,
                sourceType: opts.sourceType || null,
                sourceId: opts.sourceId || null,
                periodId: opts.periodId,
                isPosted: true,
                createdById: adminUser.id,
            },
        });
        for (const line of opts.lines) {
            await prisma.journalLine.create({
                data: {
                    journalId: journal.id,
                    accountId: accountMap[line.accountCode],
                    debit: line.debit,
                    credit: line.credit,
                    description: line.desc || opts.description,
                },
            });
        }
        return journal;
    }

    // ----- Savings Accounts & Transactions -----
    console.log("💰 Creating savings accounts & transactions for all members...");
    let savingsTxSeq = 0;

    for (let i = 0; i < memberIds.length; i++) {
        const memberId = memberIds[i];
        const branchId = memberBranchIds[i];
        const memberName = MEMBERS_DATA[i].name;
        const joinDate = new Date(2026, 0, 5 + i);

        for (const sp of SAVINGS_PRODUCTS) {
            const productId = savingsProductMap[sp.code];
            const accountNo = `${sp.code}-MBR-2026${String(i + 1).padStart(4, "0")}`;

            let initialDeposit = sp.code === "SP" ? 100000 : sp.code === "SW" ? 50000 : 0;
            let extraDeposits: { date: Date; amount: number }[] = [];

            if (sp.code === "SW") {
                // Monthly mandatory savings for Jan & Feb 2026
                extraDeposits = [
                    { date: new Date(2026, 1, 5 + i), amount: 50000 },
                ];
            }
            if (sp.code === "SS") {
                // Some voluntary savings
                initialDeposit = [200000, 500000, 300000, 150000, 1000000, 250000, 400000, 350000, 600000, 800000][i];
                extraDeposits = [
                    { date: new Date(2026, 1, 10 + i), amount: [100000, 200000, 150000, 50000, 500000, 100000, 200000, 150000, 300000, 250000][i] },
                ];
            }

            let balance = 0;
            const savingsAccount = await prisma.savingsAccount.create({
                data: {
                    accountNo, memberId, productId, branchId,
                    balance: initialDeposit + extraDeposits.reduce((s, d) => s + d.amount, 0),
                    openedDate: joinDate, status: "active",
                },
            });

            // Initial deposit transaction
            if (initialDeposit > 0) {
                savingsTxSeq++;
                const balBefore = balance;
                balance += initialDeposit;
                const journal = await createJournal({
                    branchId, date: joinDate, periodId: periodMap[1],
                    description: `Setoran ${sp.name} - ${memberName}`,
                    sourceType: "savings_transaction",
                    lines: [
                        { accountCode: "1101", debit: initialDeposit, credit: 0 },
                        { accountCode: sp.code === "SP" ? "2101" : sp.code === "SW" ? "2102" : "2103", debit: 0, credit: initialDeposit },
                    ],
                });

                await prisma.savingsTransaction.create({
                    data: {
                        transactionNo: `STX-2026${String(savingsTxSeq).padStart(5, "0")}`,
                        accountId: savingsAccount.id, memberId, productId, branchId,
                        type: "deposit", amount: initialDeposit,
                        balanceBefore: balBefore, balanceAfter: balance,
                        paymentMethod: "cash", transactionDate: joinDate,
                        journalId: journal.id, periodId: periodMap[1],
                        notes: `Setoran awal ${sp.name}`,
                        createdById: adminUser.id,
                    },
                });
            }

            // Extra deposits
            for (const dep of extraDeposits) {
                savingsTxSeq++;
                const balBefore = balance;
                balance += dep.amount;
                const pMonth = dep.date.getMonth() + 1;
                const journal = await createJournal({
                    branchId, date: dep.date, periodId: periodMap[pMonth] || periodMap[3],
                    description: `Setoran ${sp.name} - ${memberName}`,
                    lines: [
                        { accountCode: "1101", debit: dep.amount, credit: 0 },
                        { accountCode: sp.code === "SP" ? "2101" : sp.code === "SW" ? "2102" : "2103", debit: 0, credit: dep.amount },
                    ],
                });

                await prisma.savingsTransaction.create({
                    data: {
                        transactionNo: `STX-2026${String(savingsTxSeq).padStart(5, "0")}`,
                        accountId: savingsAccount.id, memberId, productId, branchId,
                        type: "deposit", amount: dep.amount,
                        balanceBefore: balBefore, balanceAfter: balance,
                        paymentMethod: "cash", transactionDate: dep.date,
                        journalId: journal.id, periodId: periodMap[pMonth] || periodMap[3],
                        notes: `Setoran bulanan ${sp.name}`,
                        createdById: adminUser.id,
                    },
                });
            }
        }
    }

    // ----- Loans (for first 5 members) -----
    console.log("🏦 Creating loans for members...");
    let loanAppSeq = 0;
    let loanSeq = 0;
    let paymentSeq = 0;

    const loanAmounts = [5000000, 10000000, 3000000, 15000000, 8000000];
    const loanTenors = [12, 12, 6, 24, 12];

    for (let i = 0; i < 5; i++) {
        const memberId = memberIds[i];
        const branchId = memberBranchIds[i];
        const memberName = MEMBERS_DATA[i].name;
        loanAppSeq++;
        loanSeq++;

        const principal = loanAmounts[i];
        const tenor = loanTenors[i];
        const rate = 12; // 12% flat annual
        const monthlyInterest = (principal * rate) / 100 / 12;
        const monthlyPrincipal = principal / tenor;
        const monthlyInstallment = monthlyPrincipal + monthlyInterest;
        const totalInterest = monthlyInterest * tenor;
        const totalAmount = principal + totalInterest;
        const adminFee = principal * 0.01;
        const disbursedAmount = principal - adminFee;

        const appDate = new Date(2026, 0, 10 + i);
        const approveDate = new Date(2026, 0, 12 + i);
        const disburseDate = new Date(2026, 0, 15 + i);

        // Loan Application
        const application = await prisma.loanApplication.create({
            data: {
                applicationNo: `LA-2026${String(loanAppSeq).padStart(5, "0")}`,
                memberId, branchId, productId: loanProductMap["PR"],
                amount: principal, tenorMonths: tenor,
                purpose: ["Renovasi rumah", "Biaya pendidikan anak", "Modal usaha", "Pembelian kendaraan", "Kebutuhan keluarga"][i],
                status: "disbursed",
                submittedAt: appDate, approvedAt: approveDate, approvedById: adminUser.id,
                createdById: adminUser.id,
            },
        });

        // Journal for disbursement
        const disburseJournal = await createJournal({
            branchId, date: disburseDate, periodId: periodMap[1],
            description: `Pencairan Pinjaman - ${memberName}`,
            sourceType: "loan_disbursement",
            lines: [
                { accountCode: "1201", debit: principal, credit: 0, desc: "Piutang Pinjaman" },
                { accountCode: "1101", debit: 0, credit: disbursedAmount, desc: "Kas keluar" },
                { accountCode: "4102", debit: 0, credit: adminFee, desc: "Pendapatan admin" },
            ],
        });

        // Loan record
        const loan = await prisma.loan.create({
            data: {
                loanNo: `LN-2026${String(loanSeq).padStart(5, "0")}`,
                applicationId: application.id, memberId, branchId,
                productSnapshot: { code: "PR", name: "Pinjaman Reguler", interestRate: rate, interestMethod: "flat" },
                principalAmount: principal, interestAmount: totalInterest, totalAmount,
                adminFee, disbursedAmount, tenorMonths: tenor, interestRate: rate, interestMethod: "flat",
                monthlyInstallment,
                principalPaid: 0, interestPaid: 0, lateFeePaid: 0,
                principalOutstanding: principal, interestOutstanding: totalInterest,
                disbursementDate: disburseDate,
                firstDueDate: new Date(2026, 1, 15 + i),
                lastDueDate: new Date(2026, tenor, 15 + i),
                status: "active",
                disbursementJournalId: disburseJournal.id,
                disbursementCashBankId: cashBankMap["KAS-01"],
                periodId: periodMap[1],
            },
        });

        // Loan Schedules
        const scheduleIds: number[] = [];
        for (let inst = 1; inst <= tenor; inst++) {
            const dueDate = new Date(2026, inst, 15 + i);
            const sched = await prisma.loanSchedule.create({
                data: {
                    loanId: loan.id, installmentNo: inst,
                    dueDate, principalAmount: monthlyPrincipal,
                    interestAmount: monthlyInterest, totalAmount: monthlyInstallment,
                    status: inst <= 2 ? "paid" : "pending",
                    paidDate: inst <= 2 ? new Date(2026, inst, 10 + i) : null,
                    principalPaid: inst <= 2 ? monthlyPrincipal : 0,
                    interestPaid: inst <= 2 ? monthlyInterest : 0,
                },
            });
            scheduleIds.push(sched.id);
        }

        // Payments for first 2 installments
        let totalPrincipalPaid = 0;
        let totalInterestPaid = 0;
        for (let inst = 1; inst <= 2; inst++) {
            paymentSeq++;
            const payDate = new Date(2026, inst, 10 + i);
            const pMonth = payDate.getMonth() + 1;

            const payJournal = await createJournal({
                branchId, date: payDate, periodId: periodMap[pMonth] || periodMap[3],
                description: `Angsuran ke-${inst} - ${memberName}`,
                sourceType: "loan_payment",
                lines: [
                    { accountCode: "1101", debit: monthlyInstallment, credit: 0, desc: "Kas masuk" },
                    { accountCode: "1201", debit: 0, credit: monthlyPrincipal, desc: "Piutang berkurang" },
                    { accountCode: "4101", debit: 0, credit: monthlyInterest, desc: "Pendapatan bunga" },
                ],
            });

            const payment = await prisma.loanPayment.create({
                data: {
                    paymentNo: `PAY-2026${String(paymentSeq).padStart(5, "0")}`,
                    loanId: loan.id, memberId, branchId: branchId,
                    amount: monthlyInstallment,
                    principalPortion: monthlyPrincipal,
                    interestPortion: monthlyInterest,
                    paymentMethod: "cash",
                    cashBankAccountId: cashBankMap["KAS-01"],
                    paymentDate: payDate,
                    journalId: payJournal.id,
                    periodId: periodMap[pMonth] || periodMap[3],
                    createdById: adminUser.id,
                },
            });

            await prisma.loanPaymentAllocation.create({
                data: {
                    paymentId: payment.id,
                    scheduleId: scheduleIds[inst - 1],
                    principalAmount: monthlyPrincipal,
                    interestAmount: monthlyInterest,
                },
            });

            totalPrincipalPaid += monthlyPrincipal;
            totalInterestPaid += monthlyInterest;
        }

        // Update loan outstanding
        await prisma.loan.update({
            where: { id: loan.id },
            data: {
                principalPaid: totalPrincipalPaid,
                interestPaid: totalInterestPaid,
                principalOutstanding: principal - totalPrincipalPaid,
                interestOutstanding: totalInterest - totalInterestPaid,
            },
        });
    }

    // ----- Unit Transactions -----
    console.log("🏪 Creating unit transactions for all members...");
    let utSeq = 0;
    const unitTypes = ["toko", "fotocopy", "cuci_mobil", "fitness", "simpan_pinjam", "laundry", "resto_cafe", "playstation", "barbershop", "aset"];
    const unitDescs: Record<string, string[]> = {
        toko: ["Pembelian beras 5kg", "Pembelian minyak goreng 2L", "Pembelian gula 1kg", "Pembelian sabun deterjen"],
        fotocopy: ["Fotocopy dokumen 50 lembar", "Print warna 10 lembar", "Jilid dokumen", "Scan dokumen 20 lembar"],
        cuci_mobil: ["Cuci mobil reguler", "Cuci mobil + poles", "Cuci motor", "Interior cleaning"],
        fitness: ["Membership bulanan", "Personal training 4 sesi", "Kelas yoga bulanan", "Suplemen fitness"],
        simpan_pinjam: ["Pembayaran iuran", "Biaya administrasi", "Biaya materai", "Jasa transfer"],
        laundry: ["Cuci setrika 3kg", "Dry clean jas", "Cuci selimut besar", "Cuci sepatu"],
        resto_cafe: ["Makan siang paket", "Kopi + snack", "Catering rapat", "Makan malam keluarga"],
        playstation: ["Rental PS5 2 jam", "Rental PS5 4 jam + snack", "Turnamen bulanan", "Rental PS4 2 jam"],
        barbershop: ["Potong rambut pria", "Cukur + creambath", "Shaving + facial", "Potong rambut anak"],
        aset: ["Sewa tanah kavling A", "Sewa gedung pertemuan", "Sewa lahan parkir", "Iuran perawatan aset"],
    };
    const unitAmounts: Record<string, number[]> = {
        toko: [75000, 35000, 15000, 28000],
        fotocopy: [25000, 50000, 15000, 10000],
        cuci_mobil: [50000, 150000, 25000, 100000],
        fitness: [200000, 500000, 150000, 100000],
        simpan_pinjam: [10000, 5000, 6000, 7500],
        laundry: [30000, 75000, 40000, 35000],
        resto_cafe: [35000, 25000, 250000, 150000],
        playstation: [30000, 60000, 50000, 20000],
        barbershop: [35000, 75000, 60000, 25000],
        aset: [500000, 1000000, 300000, 100000],
    };

    for (let i = 0; i < memberIds.length; i++) {
        const memberId = memberIds[i];
        // Each member gets 3-5 unit transactions across different units
        const txCount = 3 + (i % 3);
        for (let t = 0; t < txCount; t++) {
            utSeq++;
            const uType = unitTypes[t % unitTypes.length];
            const descArr = unitDescs[uType];
            const amtArr = unitAmounts[uType];
            const desc = descArr[i % descArr.length];
            const amount = amtArr[i % amtArr.length];
            const txDate = new Date(2026, (t % 2 === 0 ? 0 : 1), 15 + i + t);
            const isPaid = t < 2; // First 2 transactions are paid

            await prisma.unitTransaction.create({
                data: {
                    transactionNo: `UT-2026${String(utSeq).padStart(5, "0")}`,
                    memberId, unitType: uType, description: desc,
                    amount, transactionDate: txDate,
                    isPaid, paidDate: isPaid ? txDate : null,
                    createdById: adminUser.id,
                },
            });
        }
    }

    // ----- Cash & Bank Transactions -----
    console.log("💵 Creating cash & bank transactions...");
    let cbTxSeq = 0;

    // Operational expenses (Non Simpan Pinjam entries)
    const opExpenses = [
        { desc: "Pembayaran gaji karyawan Januari", amount: 15000000, category: "operational", accountCode: "5101", date: new Date(2026, 0, 25), period: 1 },
        { desc: "Pembayaran sewa kantor Januari", amount: 5000000, category: "operational", accountCode: "5102", date: new Date(2026, 0, 28), period: 1 },
        { desc: "Pembayaran listrik & air Januari", amount: 2000000, category: "operational", accountCode: "5103", date: new Date(2026, 0, 30), period: 1 },
        { desc: "Pembelian ATK", amount: 500000, category: "operational", accountCode: "5104", date: new Date(2026, 0, 20), period: 1 },
        { desc: "Pembayaran gaji karyawan Februari", amount: 15000000, category: "operational", accountCode: "5101", date: new Date(2026, 1, 25), period: 2 },
        { desc: "Pembayaran sewa kantor Februari", amount: 5000000, category: "operational", accountCode: "5102", date: new Date(2026, 1, 28), period: 2 },
        { desc: "Pembayaran listrik & air Februari", amount: 1800000, category: "operational", accountCode: "5103", date: new Date(2026, 1, 28), period: 2 },
        { desc: "Biaya operasional lainnya", amount: 1000000, category: "operational", accountCode: "5106", date: new Date(2026, 1, 15), period: 2 },
    ];

    let kasBalance = 50000000;
    for (const exp of opExpenses) {
        cbTxSeq++;
        const balBefore = kasBalance;
        kasBalance -= exp.amount;

        const journal = await createJournal({
            branchId: branchMap["HO"], date: exp.date, periodId: periodMap[exp.period],
            description: exp.desc,
            sourceType: "cash_bank",
            lines: [
                { accountCode: exp.accountCode, debit: exp.amount, credit: 0 },
                { accountCode: "1101", debit: 0, credit: exp.amount },
            ],
        });

        await prisma.cashBankTransaction.create({
            data: {
                transactionNo: `CB-2026${String(cbTxSeq).padStart(5, "0")}`,
                accountId: cashBankMap["KAS-01"], branchId: branchMap["HO"],
                type: "out", category: exp.category, amount: exp.amount,
                balanceBefore: balBefore, balanceAfter: kasBalance,
                description: exp.desc, transactionDate: exp.date,
                journalId: journal.id, periodId: periodMap[exp.period],
                createdById: adminUser.id,
            },
        });
    }

    // Income cash-in entries (Non Simpan Pinjam Penerimaan)
    const incomeEntries = [
        { desc: "Penerimaan pendapatan toko Januari", amount: 3500000, category: "other", accountCode: "4201", date: new Date(2026, 0, 31), period: 1 },
        { desc: "Penerimaan unit fotocopy Januari", amount: 800000, category: "other", accountCode: "4202", date: new Date(2026, 0, 31), period: 1 },
        { desc: "Penerimaan unit cuci mobil Januari", amount: 2000000, category: "other", accountCode: "4203", date: new Date(2026, 0, 31), period: 1 },
        { desc: "Penerimaan unit fitness Januari", amount: 1500000, category: "other", accountCode: "4204", date: new Date(2026, 0, 31), period: 1 },
        { desc: "Penerimaan pendapatan toko Februari", amount: 4200000, category: "other", accountCode: "4201", date: new Date(2026, 1, 28), period: 2 },
        { desc: "Penerimaan lain-lain Februari", amount: 500000, category: "other", accountCode: "4301", date: new Date(2026, 1, 28), period: 2 },
    ];

    for (const inc of incomeEntries) {
        cbTxSeq++;
        const balBefore = kasBalance;
        kasBalance += inc.amount;

        const journal = await createJournal({
            branchId: branchMap["HO"], date: inc.date, periodId: periodMap[inc.period],
            description: inc.desc,
            sourceType: "cash_bank",
            lines: [
                { accountCode: "1101", debit: inc.amount, credit: 0 },
                { accountCode: inc.accountCode, debit: 0, credit: inc.amount },
            ],
        });

        await prisma.cashBankTransaction.create({
            data: {
                transactionNo: `CB-2026${String(cbTxSeq).padStart(5, "0")}`,
                accountId: cashBankMap["KAS-01"], branchId: branchMap["HO"],
                type: "in", category: inc.category, amount: inc.amount,
                balanceBefore: balBefore, balanceAfter: kasBalance,
                description: inc.desc, transactionDate: inc.date,
                journalId: journal.id, periodId: periodMap[inc.period],
                createdById: adminUser.id,
            },
        });
    }

    // Update Kas Besar final balance
    await prisma.cashBankAccount.update({
        where: { id: cashBankMap["KAS-01"] },
        data: { currentBalance: kasBalance },
    });

    // ----- Print Summary -----
    console.log("\n✅ Demo seed completed successfully!\n");
    console.log("═══════════════════════════════════════════════════");
    console.log("                    AKUN LOGIN                     ");
    console.log("═══════════════════════════════════════════════════");
    console.log("");
    console.log("  🔑 OPERATOR:");
    console.log("     Email    : admin@koperasi.com");
    console.log("     Password : password123");
    console.log("");
    console.log("  👨‍💼 ADMIN & KASIR:");
    console.log("     admin.sp@koperasi.com      (Admin Simpan Pinjam)");
    console.log("     admin.toko@koperasi.com     (Admin Toko)");
    console.log("     admin.fitness@koperasi.com  (Admin Fitness)");
    console.log("     kasir.sp@koperasi.com       (Kasir Simpan Pinjam)");
    console.log("     kasir.toko@koperasi.com     (Kasir Toko)");
    console.log("     kasir.fitness@koperasi.com  (Kasir Fitness)");
    console.log("     Password semua: password123");
    console.log("");
    console.log("  👤 ANGGOTA (10 akun):");
    console.log("  ┌─────────────┬──────────────────────┬──────────────────────────┐");
    console.log("  │ NRP         │ Nama                 │ Login Email              │");
    console.log("  ├─────────────┼──────────────────────┼──────────────────────────┤");

    for (const m of MEMBERS_DATA) {
        const nrp = m.nrp.padEnd(11);
        const name = m.name.padEnd(20);
        const loginEmail = `${m.nrp}@koperasi.local`.padEnd(24);
        console.log(`  │ ${nrp} │ ${name} │ ${loginEmail} │`);
    }

    console.log("  └─────────────┴──────────────────────┴──────────────────────────┘");
    console.log("     Password semua anggota: password123");
    console.log("");
    console.log("  📊 DATA DEMO:");
    console.log("     • 6 cabang Jawa Timur");
    console.log("     • 10 anggota + data gaji");
    console.log("     • 10 unit bisnis Primkoppol");
    console.log("     • 60+ transaksi unit");
    console.log("     • Jurnal akuntansi otomatis");
    console.log("     • Kas & Bank operasional");
    console.log("     • Periode fiskal Jan-Mar 2026");
    console.log("═══════════════════════════════════════════════════\n");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
