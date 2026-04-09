import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ======= PERMISSIONS & ROLES =======
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

const ROLES = [
    { name: "operator", displayName: "Operator", description: "Super Admin", isSystem: true, permissions: ["manage_all"] },
    { name: "admin", displayName: "Admin Unit", description: "Admin per unit", isSystem: true, permissions: ["manage_anggota", "view_anggota", "manage_simpanan", "view_simpanan", "manage_pinjaman", "view_pinjaman", "approve_pinjaman", "manage_kas_bank", "view_jurnal", "view_laporan", "approve_transactions", "manage_toko", "manage_unit_transactions", "manage_pengumuman"] },
    { name: "kasir", displayName: "Kasir", description: "Cashier per unit", isSystem: true, permissions: ["view_anggota", "manage_simpanan", "view_simpanan", "view_pinjaman", "manage_kas_bank", "manage_toko", "manage_unit_transactions"] },
    { name: "anggota", displayName: "Anggota", description: "Member Portal", isSystem: true, permissions: ["view_own_data"] },
];

const COA = [
    // ASSETS
    { code: "1000", name: "Aset", type: "asset", level: 1, isDetail: false, normalBalance: "debit", category: "asset" },
    { code: "1100", name: "Kas & Bank", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "current_asset" },
    { code: "1101", name: "Kas Besar", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1103", name: "Bank BRI", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1104", name: "Bank Jatim", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1100", category: "current_asset" },
    { code: "1200", name: "Piutang", type: "asset", level: 2, isDetail: false, normalBalance: "debit", parentCode: "1000", category: "current_asset" },
    { code: "1201", name: "Piutang Pinjaman Anggota", type: "asset", level: 3, isDetail: true, normalBalance: "debit", parentCode: "1200", category: "current_asset" },
    
    // LIABILITIES
    { code: "2000", name: "Kewajiban", type: "liability", level: 1, isDetail: false, normalBalance: "credit", category: "liability" },
    { code: "2100", name: "Simpanan Anggota", type: "liability", level: 2, isDetail: false, normalBalance: "credit", parentCode: "2000", category: "current_liability" },
    { code: "2101", name: "Simpanan Pokok", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    { code: "2102", name: "Simpanan Wajib", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    { code: "2103", name: "Simpanan Sukarela", type: "liability", level: 3, isDetail: true, normalBalance: "credit", parentCode: "2100", category: "current_liability" },
    
    // EQUITY
    { code: "3000", name: "Modal", type: "equity", level: 1, isDetail: false, normalBalance: "credit", category: "equity" },
    { code: "3103", name: "SHU Tahun Berjalan", type: "equity", level: 2, isDetail: true, normalBalance: "credit", parentCode: "3000", category: "equity" },
    
    // INCOME
    { code: "4000", name: "Pendapatan", type: "income", level: 1, isDetail: false, normalBalance: "credit", category: "income" },
    { code: "4101", name: "Pendapatan Bunga Pinjaman", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    { code: "4201", name: "Pendapatan Toko", type: "income", level: 2, isDetail: true, normalBalance: "credit", parentCode: "4000", category: "income" },
    
    // EXPENSE
    { code: "5000", name: "Beban", type: "expense", level: 1, isDetail: false, normalBalance: "debit", category: "expense" },
    { code: "5101", name: "Beban Operasional", type: "expense", level: 2, isDetail: true, normalBalance: "debit", parentCode: "5000", category: "expense" }
];

async function main() {
    console.log("🌱 STARTING UAT STAGING SEED...");
    const defaultPassword = await bcrypt.hash("password123", 10);

    console.log("🧹 1. Cleaning Database (TRUNCATE ALL)...");
    const cleanupOrder = [
        "StoreSaleItem", "StoreSale", "StoreProduct", "LoanPaymentAllocation", "LoanPayment", 
        "LoanSchedule", "Loan", "LoanApplication", "UnitTransaction", "SavingsTransaction", 
        "SavingsAccount", "CashBankTransaction", "JournalLine", "Journal", "CashBankAccount", 
        "ApprovalRequest", "Receipt", "User", "Member", "FiscalPeriod", "SavingsProduct", 
        "LoanProduct", "Account", "RolePermission", "Permission", "Branch", "Role"
    ];

    for (const table of cleanupOrder) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table === 'Account' ? 'accounts' : table === 'User' ? 'users' : table === 'Role' ? 'roles' : table === 'Member' ? 'members' : table === 'Branch' ? 'branches' : table === 'StoreSale' ? 'store_sales' : table === 'StoreSaleItem' ? 'store_sale_items' : table === 'StoreProduct' ? 'store_products' : table === 'Permission' ? 'permissions' : table === 'RolePermission' ? 'role_permissions' : table === 'Loan' ? 'loans' : table === 'LoanPayment' ? 'loan_payments' : table === 'LoanPaymentAllocation' ? 'loan_payment_allocations' : table === 'LoanSchedule' ? 'loan_schedules' : table === 'LoanApplication' ? 'loan_applications' : table === 'UnitTransaction' ? 'unit_transactions' : table === 'SavingsTransaction' ? 'savings_transactions' : table === 'SavingsAccount' ? 'savings_accounts' : table === 'CashBankTransaction' ? 'cash_bank_transactions' : table === 'CashBankAccount' ? 'cash_bank_accounts' : table === 'Journal' ? 'journals' : table === 'JournalLine' ? 'journal_lines' : table === 'ApprovalRequest' ? 'approval_requests' : table === 'Receipt' ? 'receipts' : table === 'FiscalPeriod' ? 'fiscal_periods' : table === 'SavingsProduct' ? 'savings_products' : table === 'LoanProduct' ? 'loan_products' : table}" CASCADE;`);
    }

    console.log("🔑 2. Roles & Branches...");
    for (const perm of PERMISSIONS) await prisma.permission.create({ data: perm });
    const roleMap: Record<string, number> = {};
    for (const role of ROLES) {
        const { permissions, ...roleData } = role;
        const created = await prisma.role.create({ data: roleData });
        roleMap[role.name] = created.id;
        for (const p of permissions) {
            const rp = await prisma.permission.findUnique({ where: { name: p } });
            if (rp) await prisma.rolePermission.create({ data: { roleId: created.id, permissionId: rp.id } });
        }
    }

    const branch = await prisma.branch.create({
        data: { code: "UAT", name: "Primkoppol Resor Lumajang (STAGING)", isHeadOffice: true, isActive: true }
    });
    const branchId = branch.id;

    console.log("📊 3. Chart of Accounts & Products...");
    const accountMap: Record<string, number> = {};
    for (const acc of COA) {
        const { parentCode, ...data } = acc as any;
        const created = await prisma.account.create({ data });
        accountMap[acc.code] = created.id;
    }
    for (const acc of COA) {
        const { parentCode } = acc as any;
        if (parentCode && accountMap[parentCode]) {
            await prisma.account.update({ where: { id: accountMap[acc.code] }, data: { parentId: accountMap[parentCode] } });
        }
    }

    const sp1 = await prisma.savingsProduct.create({ data: { code: "SP", name: "Simpanan Pokok", type: "pokok", isMandatory: true, depositPeriod: "once", minimumAmount: 100000, canWithdraw: false, glAccountId: accountMap["2101"] }});
    const sp2 = await prisma.savingsProduct.create({ data: { code: "SW", name: "Simpanan Wajib", type: "wajib", isMandatory: true, depositPeriod: "monthly", minimumAmount: 50000, canWithdraw: false, glAccountId: accountMap["2102"] }});
    const sp3 = await prisma.savingsProduct.create({ data: { code: "SS", name: "Simpanan Sukarela", type: "sukarela", isMandatory: false, depositPeriod: "optional", minimumAmount: 10000, canWithdraw: true, glAccountId: accountMap["2103"] }});
    const lp1 = await prisma.loanProduct.create({ data: { code: "PR", name: "Pinjaman UAT Khusus", version: 1, interestMethod: "flat", interestRate: 1.0, interestCalculation: "monthly", minTenorMonths: 1, maxTenorMonths: 36, minAmount: 1000000, maxAmount: 50000000, adminFeeType: "percent", adminFeeValue: 1.0, lateFeeType: "fixed", lateFeeValue: 50000, effectiveDate: new Date("2024-01-01") }});

    console.log("💵 4. Set Up Cash & Bank...");
    const cashBankMap: Record<string, number> = {};
    const cashBankData = [
        { code: "KAS-01", name: "KAS TUNAI (KOPERASI)", type: "cash", branchId, glAccountId: accountMap["1101"], currentBalance: 15400000 },
        { code: "BRI-01", name: "BANK BRI 009-XXXXX", type: "bank", bankName: "BRI", branchId, glAccountId: accountMap["1103"], currentBalance: 250000000 },
        { code: "JATIM-01", name: "BANK JATIM 018-XXXX", type: "bank", bankName: "JATIM", branchId, glAccountId: accountMap["1104"], currentBalance: 88500000 },
    ];
    for(const c of cashBankData) {
        const created = await prisma.cashBankAccount.create({ data: c });
        cashBankMap[c.code] = created.id;
    }

    console.log("👨‍💼 5. Creating Users (Operator, Admins, Kasirs)...");
    
    // Operator
    await prisma.user.create({ data: { name: "Operator UAT", email: "operator@uat.com", password: defaultPassword, roleId: roleMap["operator"], branchId, isActive: true } });

    // Multi-Unit Roles
    const ALL_UNITS = ["simpan_pinjam", "toko", "fitness", "cuci_mobil", "fotocopy", "laundry", "resto_cafe", "playstation", "barbershop", "aset"];
    
    for (const unit of ALL_UNITS) {
        await prisma.user.create({ data: { name: `Admin ${unit.toUpperCase()}`, email: `admin.${unit}@uat.com`, password: defaultPassword, roleId: roleMap["admin"], branchId, unitType: unit, isActive: true }});
        await prisma.user.create({ data: { name: `Kasir ${unit.toUpperCase()}`, email: `kasir.${unit}@uat.com`, password: defaultPassword, roleId: roleMap["kasir"], branchId, unitType: unit, isActive: true }});
    }

    console.log("👥 6. Creating 10 Unique UAT Members...");
    const dummyMembers = [
        { nrp: "111", name: "Kompol Anton", sal: 12000000, cat: "Polri" },
        { nrp: "222", name: "AKP Budi", sal: 8000000, cat: "Polri" },
        { nrp: "333", name: "Iptu Cahyo", sal: 6500000, cat: "Polri" },
        { nrp: "444", name: "Aiptu Didik", sal: 5000000, cat: "Polri" },
        { nrp: "555", name: "Bripka Eko", sal: 4000000, cat: "Polri" },
        { nrp: "666", name: "PNS Fajar", sal: 5500000, cat: "PNS" },
        { nrp: "777", name: "PNS Galih", sal: 4800000, cat: "PNS" },
        { nrp: "888", name: "PNS Hendra", sal: 3500000, cat: "PNS" },
        { nrp: "999", name: "PHL Iwan", sal: 2500000, cat: "PHL" },
        { nrp: "000", name: "PHL Joko (Non-Aktif)", sal: 0, cat: "PHL", status: "inactive" },
    ];

    for (const m of dummyMembers) {
        const member = await prisma.member.create({
            data: {
                nrp: m.nrp, memberNo: m.nrp, name: m.name, salary: m.sal, category: m.cat, city: "Lumajang", branchId, status: m.status || "active",
                tabunganWajib: (m.sal > 0) ? (Math.random() * 500000) : 0,
                tunlesKinerja: (m.sal > 5000000) ? 200000 : 0
            }
        });
        
        // Buat Akun Sistem Anggota
        await prisma.user.create({ data: { name: m.name, email: `anggota.${m.nrp}@uat.com`, password: defaultPassword, roleId: roleMap["anggota"], branchId, memberId: member.id, isActive: true }});

        // Buat Rekening Pokok & Wajib defaults
        if (m.status !== "inactive") {
            // Pokok
            const acc1 = await prisma.savingsAccount.create({ data: { memberId: member.id, productId: sp1.id, branchId, accountNumber: `SPK-${m.nrp}`, balance: 100000, status: "active" }});
            await prisma.savingsTransaction.create({ data: { accountId: acc1.id, branchId, transactionDate: new Date(), type: "deposit", amount: 100000, balanceBefore: 0, balanceAfter: 100000, referenceNo: `DEP-SP-${m.nrp}`, description: "Penyetoran Simpanan Pokok Awal" }});
            // Wajib
            const acc2 = await prisma.savingsAccount.create({ data: { memberId: member.id, productId: sp2.id, branchId, accountNumber: `SWJ-${m.nrp}`, balance: 250000, status: "active" }});
            await prisma.savingsTransaction.create({ data: { accountId: acc2.id, branchId, transactionDate: new Date(), type: "deposit", amount: 250000, balanceBefore: 0, balanceAfter: 250000, referenceNo: `DEP-SW-${m.nrp}`, description: "Penyetoran Simpanan Wajib Awal" }});
        }
    }

    // 7. Inject Some Operational Transactions into Kas/Bank
    console.log("💰 7. Injecting Dummy Transactions...");
    await prisma.cashBankTransaction.create({
        data: {
            accountId: cashBankMap["KAS-01"], branchId, transactionDate: new Date(new Date().getTime() - 86400000), 
            type: "out", amount: 150000, balanceBefore: 15550000, balanceAfter: 15400000, category: "biaya_operasional", 
            referenceNo: "CB-001", description: "Pembayaran ATK dan Kebutuhan Kantor Staging", status: "completed"
        }
    });

    console.log("🎉 UAT DATA SEED FINISHED SUCCESSFULLY!");
    console.log("User Admin Toko: admin.toko@uat.com | kasir.toko@uat.com");
    console.log("User Cuci Mobil: admin.cuci_mobil@uat.com | kasir.cuci_mobil@uat.com");
    console.log("User Anggota   : anggota.111@uat.com");
    console.log("Password All   : password123");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
