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
];

const ROLES = [
    {
        name: "super_admin",
        displayName: "Super Admin",
        description: "Full access to all features",
        isSystem: true,
        permissions: PERMISSIONS.map((p) => p.name),
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
    console.log("Creating admin user...");
    const superAdminRole = await prisma.role.findUnique({
        where: { name: "super_admin" },
    });

    if (superAdminRole) {
        const hashedPassword = await bcrypt.hash("admin123", 12);
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

    await prisma.fiscalPeriod.upsert({
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

    console.log("✅ Seed completed successfully!");
    console.log("");
    console.log("Default admin credentials:");
    console.log("  Email: admin@koperasi.com");
    console.log("  Password: admin123");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
