import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
    // User Management
    { name: "user_management", displayName: "Kelola Pengguna", module: "users" },
    // Master Data
    { name: "master_data", displayName: "Master Data", module: "master" },
    // Members
    { name: "manage_anggota", displayName: "Kelola Anggota", module: "anggota" },
    { name: "view_anggota", displayName: "Lihat Anggota", module: "anggota" },
    // Savings
    { name: "manage_simpanan", displayName: "Kelola Simpanan", module: "simpanan" },
    { name: "view_simpanan", displayName: "Lihat Simpanan", module: "simpanan" },
    // Loans
    { name: "manage_pinjaman", displayName: "Kelola Pinjaman", module: "pinjaman" },
    { name: "view_pinjaman", displayName: "Lihat Pinjaman", module: "pinjaman" },
    { name: "approve_pinjaman", displayName: "Approve Pinjaman", module: "pinjaman" },
    // Cash & Bank
    { name: "manage_kas_bank", displayName: "Kelola Kas & Bank", module: "kas_bank" },
    // Journals
    { name: "manage_jurnal", displayName: "Kelola Jurnal", module: "jurnal" },
    { name: "view_jurnal", displayName: "Lihat Jurnal", module: "jurnal" },
    // Reports
    { name: "view_laporan", displayName: "Lihat Laporan", module: "laporan" },
    // Approvals
    { name: "approve_transactions", displayName: "Approve Transaksi", module: "approval" },
    // Unit Transactions
    { name: "manage_unit_transactions", displayName: "Kelola Transaksi Unit", module: "unit_transactions" },
    // Member Portal (for anggota role)
    { name: "view_own_data", displayName: "Lihat Data Sendiri", module: "portal" },
];

const ROLES = [
    {
        name: "super_admin",
        displayName: "Super Admin",
        description: "Full access to all features",
        isSystem: true,
        permissions: PERMISSIONS.filter(p => p.name !== "view_own_data").map((p) => p.name),
    },
    {
        name: "admin_cabang",
        displayName: "Admin Cabang",
        description: "Branch administrator",
        isSystem: true,
        permissions: [
            "manage_anggota",
            "view_anggota",
            "manage_simpanan",
            "view_simpanan",
            "manage_pinjaman",
            "view_pinjaman",
            "manage_kas_bank",
            "view_jurnal",
            "view_laporan",
            "manage_unit_transactions",
        ],
    },
    {
        name: "teller",
        displayName: "Teller",
        description: "Front desk operations",
        isSystem: true,
        permissions: [
            "view_anggota",
            "manage_simpanan",
            "view_simpanan",
            "view_pinjaman",
            "manage_kas_bank",
        ],
    },
    {
        name: "manager",
        displayName: "Manager",
        description: "Branch manager with approval rights",
        isSystem: true,
        permissions: [
            "manage_anggota",
            "view_anggota",
            "manage_simpanan",
            "view_simpanan",
            "manage_pinjaman",
            "view_pinjaman",
            "approve_pinjaman",
            "manage_kas_bank",
            "view_jurnal",
            "view_laporan",
            "approve_transactions",
            "manage_unit_transactions",
        ],
    },
    {
        name: "anggota",
        displayName: "Anggota",
        description: "Member with view-only access to own data",
        isSystem: true,
        permissions: [
            "view_own_data",
        ],
    },
];

const BRANCHES = [
    {
        code: "HO",
        name: "Kantor Pusat",
        address: "Jl. Sudirman No. 123, Jakarta Pusat",
        phone: "021-5551234",
        email: "pusat@koperasi.com",
        isHeadOffice: true,
        isActive: true,
    },
    {
        code: "JKT",
        name: "Cabang Jakarta Selatan",
        address: "Jl. Gatot Subroto No. 45, Jakarta Selatan",
        phone: "021-5552345",
        email: "jaksel@koperasi.com",
        isHeadOffice: false,
        isActive: true,
    },
    {
        code: "SBY",
        name: "Cabang Surabaya",
        address: "Jl. Basuki Rahmat No. 100, Surabaya",
        phone: "031-5553456",
        email: "surabaya@koperasi.com",
        isHeadOffice: false,
        isActive: true,
    },
];

const SAVINGS_PRODUCTS = [
    {
        code: "SP",
        name: "Simpanan Pokok",
        type: "pokok",
        isMandatory: true,
        depositPeriod: "once",
        minimumAmount: 100000,
        canWithdraw: false,
        isActive: true,
    },
    {
        code: "SW",
        name: "Simpanan Wajib",
        type: "wajib",
        isMandatory: true,
        depositPeriod: "monthly",
        minimumAmount: 50000,
        canWithdraw: false,
        isActive: true,
    },
    {
        code: "SS",
        name: "Simpanan Sukarela",
        type: "sukarela",
        isMandatory: false,
        depositPeriod: "optional",
        minimumAmount: 10000,
        canWithdraw: true,
        isActive: true,
    },
];

const LOAN_PRODUCTS = [
    {
        code: "PR",
        name: "Pinjaman Reguler",
        version: 1,
        interestMethod: "flat",
        interestRate: 12.0,
        interestCalculation: "monthly",
        minTenorMonths: 3,
        maxTenorMonths: 36,
        minAmount: 1000000,
        maxAmount: 50000000,
        adminFeeType: "percent",
        adminFeeValue: 1.0,
        lateFeeType: "percent_per_day",
        lateFeeValue: 0.1,
        gracePeriodDays: 7,
        requiresCollateral: false,
        effectiveDate: new Date("2025-01-01"),
        isCurrent: true,
        isActive: true,
    },
    {
        code: "PU",
        name: "Pinjaman Usaha",
        version: 1,
        interestMethod: "flat",
        interestRate: 10.0,
        interestCalculation: "monthly",
        minTenorMonths: 6,
        maxTenorMonths: 60,
        minAmount: 5000000,
        maxAmount: 200000000,
        adminFeeType: "percent",
        adminFeeValue: 1.5,
        lateFeeType: "percent_per_day",
        lateFeeValue: 0.1,
        gracePeriodDays: 7,
        requiresCollateral: true,
        effectiveDate: new Date("2025-01-01"),
        isCurrent: true,
        isActive: true,
    },
];

async function main() {
    console.log("🌱 Starting seed...");

    // Create permissions
    console.log("Creating permissions...");
    for (const perm of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }

    // Create roles with permissions
    console.log("Creating roles...");
    for (const role of ROLES) {
        const { permissions, ...roleData } = role;
        const createdRole = await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: roleData,
        });

        // Link permissions
        for (const permName of permissions) {
            const perm = await prisma.permission.findUnique({
                where: { name: permName },
            });
            if (perm) {
                await prisma.rolePermission.upsert({
                    where: {
                        roleId_permissionId: {
                            roleId: createdRole.id,
                            permissionId: perm.id,
                        },
                    },
                    update: {},
                    create: {
                        roleId: createdRole.id,
                        permissionId: perm.id,
                    },
                });
            }
        }
    }

    // Create branches
    console.log("Creating branches...");
    for (const branch of BRANCHES) {
        await prisma.branch.upsert({
            where: { code: branch.code },
            update: {},
            create: branch,
        });
    }

    // Create super admin user
    console.log("Creating admin users...");
    const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } });
    const branchAdminRole = await prisma.role.findUnique({ where: { name: "admin_cabang" } });
    const anggotaRole = await prisma.role.findUnique({ where: { name: "anggota" } });

    const hashedPassword = await bcrypt.hash("admin123", 12);
    const memberPassword = await bcrypt.hash("anggota123", 12);

    if (superAdminRole) {
        await prisma.user.upsert({
            where: { email: "admin@koperasi.com" },
            update: {},
            create: {
                name: "Super Admin",
                email: "admin@koperasi.com",
                password: hashedPassword,
                roleId: superAdminRole.id,
                branchId: null, // Access to all branches
                isActive: true,
            },
        });
    }

    // Create branch admin
    if (branchAdminRole) {
        const jakartaBranch = await prisma.branch.findUnique({ where: { code: "JKT" } });
        if (jakartaBranch) {
            await prisma.user.upsert({
                where: { email: "admin.jkt@koperasi.com" },
                update: {},
                create: {
                    name: "Admin Jakarta",
                    email: "admin.jkt@koperasi.com",
                    password: hashedPassword,
                    roleId: branchAdminRole.id,
                    branchId: jakartaBranch.id,
                    isActive: true,
                },
            });
        }
    }

    // Create savings products
    console.log("Creating savings products...");
    for (const product of SAVINGS_PRODUCTS) {
        await prisma.savingsProduct.upsert({
            where: { code: product.code },
            update: {},
            create: product,
        });
    }

    // Create loan products
    console.log("Creating loan products...");
    for (const product of LOAN_PRODUCTS) {
        await prisma.loanProduct.upsert({
            where: { code_version: { code: product.code, version: product.version } },
            update: {},
            create: product,
        });
    }

    // Create fiscal period for current month
    console.log("Creating fiscal period...");
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const period = await prisma.fiscalPeriod.upsert({
        where: { year_month: { year: now.getFullYear(), month: now.getMonth() + 1 } },
        update: {},
        create: {
            name: `${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            startDate: startOfMonth,
            endDate: endOfMonth,
            status: "open",
        },
    });

    // Create Member with NRP
    console.log("Creating dummy member...");
    const jakartaBranch = await prisma.branch.findUnique({ where: { code: "JKT" } });
    if (jakartaBranch) {
        const member = await prisma.member.upsert({
            where: { memberNo: "MBR-20250001" },
            update: { nrp: "12345678" },
            create: {
                memberNo: "MBR-20250001",
                nrp: "12345678",
                name: "Budi Santoso",
                nik: "3171010101900001",
                gender: "male",
                birthPlace: "Jakarta",
                birthDate: new Date("1990-01-01"),
                maritalStatus: "married",
                address: "Jl. Tebet Raya No. 10",
                city: "Jakarta Selatan",
                phone: "081234567890",
                email: "budi@example.com",
                branchId: jakartaBranch.id,
                joinDate: new Date(),
                status: "active",
            },
        });

        // Create user account for member (anggota login)
        if (anggotaRole) {
            await prisma.user.upsert({
                where: { email: "12345678@koperasi.local" },
                update: { memberId: member.id },
                create: {
                    name: member.name,
                    email: "12345678@koperasi.local",
                    password: memberPassword,
                    roleId: anggotaRole.id,
                    branchId: jakartaBranch.id,
                    memberId: member.id,
                    isActive: true,
                },
            });
        }

        // Create Savings Account (Simpanan Pokok)
        const spProduct = await prisma.savingsProduct.findUnique({ where: { code: "SP" } });
        if (spProduct) {
            const account = await prisma.savingsAccount.upsert({
                where: { memberId_productId: { memberId: member.id, productId: spProduct.id } },
                update: {},
                create: {
                    accountNo: `SP-${member.memberNo}`,
                    memberId: member.id,
                    productId: spProduct.id,
                    branchId: jakartaBranch.id,
                    balance: 100000,
                    openedDate: new Date(),
                    status: "active",
                },
            });

            // Transaction: Setoran Awal
            const adminUser = await prisma.user.findUnique({ where: { email: "admin@koperasi.com" } });
            if (adminUser) {
                await prisma.savingsTransaction.create({
                    data: {
                        transactionNo: `TRX-${Date.now()}`,
                        accountId: account.id,
                        memberId: member.id,
                        productId: spProduct.id,
                        branchId: jakartaBranch.id,
                        type: "deposit",
                        amount: 100000,
                        balanceBefore: 0,
                        balanceAfter: 100000,
                        notes: "Setoran Awal Simpanan Pokok",
                        transactionDate: new Date(),
                        periodId: period.id,
                        createdById: adminUser.id,
                    },
                });

                // Create sample unit transactions
                console.log("Creating sample unit transactions...");
                const unitTransactions = [
                    {
                        transactionNo: `UT-${Date.now()}-001`,
                        memberId: member.id,
                        unitType: "toko",
                        description: "Pembelian beras 5kg",
                        amount: 75000,
                        transactionDate: new Date(),
                        isPaid: true,
                        paidDate: new Date(),
                        createdById: adminUser.id,
                    },
                    {
                        transactionNo: `UT-${Date.now()}-002`,
                        memberId: member.id,
                        unitType: "fotocopy",
                        description: "Fotocopy dokumen 50 lembar",
                        amount: 25000,
                        transactionDate: new Date(),
                        isPaid: false,
                        createdById: adminUser.id,
                    },
                    {
                        transactionNo: `UT-${Date.now()}-003`,
                        memberId: member.id,
                        unitType: "cuci_mobil",
                        description: "Cuci mobil + poles",
                        amount: 150000,
                        transactionDate: new Date(),
                        isPaid: false,
                        createdById: adminUser.id,
                    },
                    {
                        transactionNo: `UT-${Date.now()}-004`,
                        memberId: member.id,
                        unitType: "fitness",
                        description: "Membership bulanan fitness",
                        amount: 200000,
                        transactionDate: new Date(),
                        isPaid: true,
                        paidDate: new Date(),
                        createdById: adminUser.id,
                    },
                ];

                for (const tx of unitTransactions) {
                    await prisma.unitTransaction.create({ data: tx });
                }
            }
        }
    }

    console.log("✅ Seed completed successfully!");
    console.log("");
    console.log("Credentials:");
    console.log("  Super Admin: admin@koperasi.com / admin123");
    console.log("  Branch Admin: admin.jkt@koperasi.com / admin123");
    console.log("  Anggota: 12345678@koperasi.local / anggota123 (NRP: 12345678)");
    console.log("  Member: Budi Santoso (MBR-20250001, NRP: 12345678)");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
