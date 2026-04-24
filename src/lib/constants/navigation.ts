// Navigation configuration for the Koperasi Digital application
// RBAC v2: Supports role-based + unitType-based filtering

import {
    LayoutDashboard,
    Users,
    Wallet,
    CreditCard,
    Building,
    ArrowLeftRight,
    Package,
    BookOpen,
    FileText,
    Lock,
    PieChart,
    CheckSquare,
    Database,
    UserCog,
    Building2,
    Settings,
    ShoppingBag,
    Megaphone,
    User,
    Activity,
    Receipt,
    Store,
    ClipboardList,
    Bell,
    QrCode,
    Boxes,
    BarChart2,
    TrendingDown,
    Tag,
    type LucideIcon,
    Timer,
    UtensilsCrossed,
    Scissors,
    Gamepad2,
    Dumbbell,
    Shirt,
    Copy,
} from "lucide-react";

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon;
    permission?: string; // Required permission key
    roles?: string[];    // If set, only these roles can see this item
    badge?: string;
    children?: NavItem[];
}

export interface NavGroup {
    title: string;
    roles?: string[]; // If set, only these roles see this group
    items: NavItem[];
}

// ============================================================
// FULL NAVIGATION — for Operator (manage_all)
// ============================================================
export const mainNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

    {
        title: "OPERASIONAL",
        items: [
            {
                title: "Anggota", href: "/anggota", icon: Users,
                permission: "manage_anggota",
                children: [
                    { title: "Daftar Anggota", href: "/anggota" },
                    { title: "Kartu Anggota", href: "/anggota/kartu" },
                    { title: "Buku Anggota", href: "/anggota/buku" },
                ],
            },
            {
                title: "Simpanan", href: "/simpanan", icon: Wallet,
                permission: "manage_simpanan",
                children: [
                    { title: "Rekening Anggota", href: "/simpanan/rekening" },
                    { title: "Transaksi Simpanan", href: "/simpanan/transaksi" },
                    { title: "Rekap Simpanan", href: "/simpanan/rekap" },
                ],
            },
            {
                title: "Pinjaman", href: "/pinjaman", icon: CreditCard,
                permission: "manage_pinjaman",
                children: [
                    { title: "Pengajuan", href: "/pinjaman/pengajuan" },
                    { title: "Daftar Pinjaman", href: "/pinjaman" },
                    { title: "Angsuran", href: "/pinjaman/angsuran" },
                    { title: "Jadwal Angsuran", href: "/pinjaman/jadwal" },
                ],
            },
            {
                title: "Kas & Bank", href: "/kas-bank", icon: Building,
                permission: "manage_kas_bank",
                roles: ["operator", "admin"], // kasir tidak punya
                children: [
                    { title: "Buku Kas", href: "/kas-bank/buku-kas" },
                    { title: "Transaksi Kas", href: "/kas-bank/kas" },
                    { title: "Transaksi Bank", href: "/kas-bank/bank" },
                    { title: "Transfer", href: "/kas-bank/transfer" },
                ],
            },
            {
                title: "Non Simpan Pinjam", href: "/non-sp", icon: ArrowLeftRight,
                permission: "manage_kas_bank",
                roles: ["operator", "admin"],
                children: [
                    { title: "Penerimaan", href: "/non-sp/penerimaan" },
                    { title: "Pengeluaran", href: "/non-sp/pengeluaran" },
                ],
            },
            {
                title: "Transaksi Unit Layanan", href: "/transaksi-unit", icon: Wallet,
                permission: "manage_unit_transactions",
                children: [
                    { title: "Kasir POS", href: "/unit-layanan/kasir", permission: "manage_unit_transactions" },
                    { title: "Piutang & Riwayat", href: "/transaksi-unit" },
                ],
            },
            {
                title: "Kwitansi", href: "/kwitansi", icon: Receipt,
                permission: "manage_unit_transactions",
                roles: ["operator", "admin"],
            },
        ],
    },

    {
        title: "AKUNTANSI",
        roles: ["operator", "admin"],
        items: [
            {
                title: "Aset", href: "/aset", icon: Package,
                permission: "manage_aset",
                children: [
                    { title: "Daftar Aset", href: "/aset" },
                    { title: "Penyusutan", href: "/aset/penyusutan" },
                ],
            },
            {
                title: "Jurnal", href: "/jurnal/umum", icon: BookOpen,
                permission: "view_jurnal",
                children: [
                    { title: "Buku Besar", href: "/jurnal/buku-besar" },
                    { title: "Jurnal Umum", href: "/jurnal/umum" },
                    { title: "Jurnal Penyesuaian", href: "/jurnal/penyesuaian" },
                ],
            },
            {
                title: "Laporan", href: "/laporan", icon: FileText,
                permission: "view_laporan",
                children: [
                    { title: "Neraca", href: "/laporan/neraca" },
                    { title: "Laba Rugi", href: "/laporan/laba-rugi" },
                    { title: "Arus Kas", href: "/laporan/arus-kas" },
                    { title: "SHU", href: "/laporan/shu" },
                    { title: "Rekap Simpanan", href: "/laporan/rekap-simpanan" },
                    { title: "Rekap Pinjaman", href: "/laporan/rekap-pinjaman" },
                    { title: "Faktur Potongan", href: "/laporan/faktur-potongan" },
                ],
            },
        ],
    },

    {
        title: "PERIODE & SHU",
        roles: ["operator"],
        items: [
            { title: "Tutup Buku", href: "/periode/tutup-buku", icon: Lock, permission: "tutup_buku" },
            {
                title: "Alokasi SHU", href: "/periode/shu/perhitungan", icon: PieChart,
                permission: "alokasi_shu",
                children: [
                    { title: "Perhitungan", href: "/periode/shu/perhitungan" },
                    { title: "Distribusi", href: "/periode/shu/distribusi" },
                ],
            },
        ],
    },

    {
        title: "TOKO",
        roles: ["operator", "admin"],
        items: [
            {
                title: "Toko PRIMKOPPOL", href: "/toko", icon: ShoppingBag,
                permission: "manage_toko",
                children: [
                    { title: "Produk", href: "/toko/produk" },
                    { title: "Kasir / POS", href: "/toko/kasir" },
                    { title: "Shift Kasir", href: "/toko/shift" },
                    { title: "Persediaan", href: "/toko/persediaan" },
                ],
            },
        ],
    },

    {
        title: "KOMUNIKASI",
        items: [
            { title: "Pengumuman", href: "/pengumuman", icon: Megaphone, permission: "manage_pengumuman" },
        ],
    },

    {
        title: "APPROVAL",
        roles: ["operator", "admin"],
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: CheckSquare,
                permission: "approve_transactions", badge: "pending_approval_count",
            },
            { title: "Audit Log", href: "/audit-log", icon: Activity, permission: "view_audit_log" },
        ],
    },

    {
        title: "PENGATURAN",
        items: [
            {
                title: "Master Data", href: "/master", icon: Database,
                permission: "master_data",
                roles: ["operator"],
                children: [
                    { title: "Produk Simpanan", href: "/master/produk-simpanan" },
                    { title: "Produk Pinjaman", href: "/master/produk-pinjaman" },
                    { title: "Bagan Akun", href: "/master/coa" },
                    { title: "Mapping Jurnal", href: "/master/mapping-jurnal" },
                    { title: "Parameter SHU", href: "/master/parameter-shu" },
                    { title: "Saldo Awal", href: "/master/saldo-awal" },
                    { title: "Master Kas & Bank", href: "/master/kas-bank" },
                    { title: "Import & Export Data", href: "/master/import-data" },
                ],
            },
            {
                title: "User Management", href: "/master/users", icon: UserCog,
                permission: "user_management", roles: ["operator"],
            },
            {
                title: "Profil PRIMKOPPOL", href: "/profil-koperasi", icon: Building2,
                permission: "edit_profil", roles: ["operator"],
            },
            { title: "Pengaturan", href: "/settings", icon: Settings },
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR TOKO NAVIGATION — kasir unit "toko", hanya POS + Shift + Riwayat
// ============================================================
export const kasirTokoNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "TOKO PRIMKOPPOL",
        items: [
            {
                title: "Kasir POS", href: "/toko/kasir", icon: Store,
                permission: "manage_toko",
            },
            {
                title: "Shift Kasir", href: "/toko/shift", icon: Timer,
                permission: "manage_toko",
            },
            {
                title: "Daftar Produk", href: "/toko/produk", icon: Package,
                permission: "manage_toko",
            },
            {
                title: "Riwayat Penjualan", href: "/transaksi-unit/riwayat?unitType=toko", icon: ClipboardList,
                permission: "manage_toko",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR NAVIGATION — unit layanan jasa (tanpa stok), POS cepat
// ============================================================
export const kasirNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "UNIT USAHA",
        items: [
            {
                title: "Kasir POS", href: "/unit/[unitSlug]/kasir", icon: Store,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
            // /settings dihapus dari kasir — kasir tidak perlu akses pengaturan sistem
        ],
    },
];

// ============================================================
// ADMIN TOKO NAVIGATION — untuk Admin unit Retail/F&B
// (Toko, Coffe Latar, Resto) — punya Manajemen Produk + Inbox Void
// ============================================================
export const adminTokoNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "TOKO & PRODUK",
        items: [
            {
                title: "Kasir POS", href: "/toko/kasir", icon: Store,
                permission: "manage_toko",
            },
            {
                title: "Manajemen Produk", href: "/toko/produk", icon: Package,
                permission: "manage_toko",
            },
            {
                title: "Promo & Diskon", href: "/toko/marketing", icon: Tag,
                permission: "manage_toko",
            },
            {
                title: "Persediaan & Stok", href: "/toko/persediaan", icon: Boxes,
                permission: "manage_toko",
            },
            {
                title: "Shift Kasir", href: "/toko/shift", icon: Timer,
                permission: "manage_toko",
            },
            {
                title: "Riwayat Penjualan", href: "/transaksi-unit/riwayat?unitType=toko", icon: ClipboardList,
                permission: "manage_toko",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Penjualan", href: "/unit/[unitSlug]/laporan", icon: BarChart2,
                permission: "manage_toko",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN UNIT JASA NAVIGATION — untuk Admin unit Jasa Cepat
// (Carwash, Barbershop, Fitness, PlayStation, Properti, dll)
// Tidak ada manajemen stok fisik, tapi ada Kelola Layanan & Harga
// ============================================================
export const adminUnitNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "UNIT LAYANAN",
        items: [
            {
                title: "Panel Kasir", href: "/unit/[unitSlug]/kasir", icon: Store,
                permission: "manage_unit_transactions",
            },
            {
                title: "Kelola Layanan & Harga", href: "/unit/[unitSlug]/layanan", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/[unitSlug]/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR RESTO NAVIGATION — kasir unit "resto_cafe", POS denah meja
// ============================================================
export const kasirRestoNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "RESTO & CAFE",
        items: [
            {
                title: "Kasir POS", href: "/resto/kasir", icon: UtensilsCrossed,
                permission: "manage_unit_transactions",
            },
            {
                title: "Shift Kasir", href: "/resto/shift", icon: Timer,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Penjualan", href: "/transaksi-unit/riwayat?unitType=resto", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN RESTO NAVIGATION — untuk Admin unit Resto & Cafe (Latar)
// POS denah meja (/resto/kasir), Manajemen Menu, Shift, dll
// ============================================================
export const adminRestoNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "RESTO & MENU",
        items: [
            {
                title: "Kasir POS", href: "/resto/kasir", icon: UtensilsCrossed,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Menu", href: "/resto/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Promo & Diskon", href: "/resto/marketing", icon: Tag,
                permission: "manage_unit_transactions",
            },
            {
                title: "Persediaan & Stok", href: "/resto/persediaan", icon: Boxes,
                permission: "manage_unit_transactions",
            },
            {
                title: "Shift Kasir", href: "/resto/shift", icon: Timer,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Penjualan", href: "/transaksi-unit/riwayat?unitType=resto", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Penjualan", href: "/unit/resto-cafe/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR BARBERSHOP NAVIGATION — dedicated POS pangkas rambut
// ============================================================
export const kasirBarbershopNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "BARBERSHOP",
        items: [
            {
                title: "Kasir POS", href: "/barbershop/kasir", icon: Scissors,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=barbershop", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN BARBERSHOP NAVIGATION — manage layanan + POS
// ============================================================
export const adminBarbershopNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "BARBERSHOP",
        items: [
            {
                title: "Kasir POS", href: "/barbershop/kasir", icon: Scissors,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Layanan", href: "/barbershop/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=barbershop", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/barbershop/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR PLAYSTATION NAVIGATION — timer-based rental POS
// ============================================================
export const kasirPSNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "PLAY STATION",
        items: [
            {
                title: "Kasir POS", href: "/play-station/kasir", icon: Gamepad2,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=playstation", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN PLAYSTATION NAVIGATION — manage console + products + POS
// ============================================================
export const adminPSNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "PLAY STATION",
        items: [
            {
                title: "Kasir POS", href: "/play-station/kasir", icon: Gamepad2,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Produk & Jasa", href: "/play-station/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=playstation", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/playstation/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR FITNESS NAVIGATION — dedicated gym/fitness POS
// ============================================================
export const kasirFitnessNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "FITNESS",
        items: [
            {
                title: "Kasir POS", href: "/fitness/kasir", icon: Dumbbell,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=fitness", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN FITNESS NAVIGATION
// ============================================================
export const adminFitnessNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "FITNESS",
        items: [
            {
                title: "Kasir POS", href: "/fitness/kasir", icon: Dumbbell,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Layanan", href: "/fitness/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=fitness", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/fitness/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR FOTOCOPY NAVIGATION — dedicated print/copy POS
// ============================================================
export const kasirFotocopyNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "FOTOCOPY & PRINT",
        items: [
            {
                title: "Kasir POS", href: "/fotocopy/kasir", icon: Copy,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=fotocopy", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN FOTOCOPY NAVIGATION
// ============================================================
export const adminFotocopyNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "FOTOCOPY & PRINT",
        items: [
            {
                title: "Kasir POS", href: "/fotocopy/kasir", icon: Copy,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Layanan", href: "/fotocopy/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=fotocopy", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/fotocopy/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// KASIR LAUNDRY NAVIGATION — dedicated laundry POS
// ============================================================
export const kasirLaundryNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "LAUNDRY",
        items: [
            {
                title: "Kasir POS", href: "/laundry/kasir", icon: Shirt,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=laundry", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// ============================================================
// ADMIN LAUNDRY NAVIGATION
// ============================================================
export const adminLaundryNavigation: (NavItem | NavGroup)[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        title: "LAUNDRY",
        items: [
            {
                title: "Kasir POS", href: "/laundry/kasir", icon: Shirt,
                permission: "manage_unit_transactions",
            },
            {
                title: "Manajemen Layanan", href: "/laundry/produk", icon: Package,
                permission: "manage_unit_transactions",
            },
            {
                title: "Riwayat Transaksi", href: "/transaksi-unit/riwayat?unitType=laundry", icon: ClipboardList,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "LAPORAN & KEUANGAN",
        items: [
            {
                title: "Laporan Transaksi", href: "/unit/laundry/laporan", icon: BarChart2,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "PERSETUJUAN",
        items: [
            {
                title: "Inbox Approval", href: "/approval", icon: Bell,
                permission: "manage_unit_transactions",
            },
        ],
    },
    {
        title: "AKUN",
        items: [
            { title: "Profil Saya", href: "/profil", icon: User },
        ],
    },
];

// Bottom navigation for mobile
export const bottomNavigation: NavItem[] = [
    { title: "Beranda", href: "/dashboard", icon: LayoutDashboard },
    { title: "Anggota", href: "/anggota", icon: Users, permission: "manage_anggota" },
    { title: "Simpanan", href: "/simpanan", icon: Wallet, permission: "manage_simpanan" },
    { title: "Pinjaman", href: "/pinjaman", icon: CreditCard, permission: "manage_pinjaman" },
];

// ============================================================
// Helpers
// ============================================================

export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
    return "items" in item;
}

export function getAllNavItems(navigation: (NavItem | NavGroup)[]): NavItem[] {
    const items: NavItem[] = [];
    for (const item of navigation) {
        if (isNavGroup(item)) {
            for (const subItem of item.items) {
                items.push(subItem);
                if (subItem.children) items.push(...subItem.children);
            }
        } else {
            items.push(item);
            if (item.children) items.push(...item.children);
        }
    }
    return items;
}

export interface UserContext {
    permissions: string[];
    roleName: string;  // "operator" | "admin" | "kasir" | "anggota"
    unitType?: string | null;
}

/**
 * Main navigation filter function.
 * Filters by: manage_all shortcut, role name (roles[]), and permission.
 */
export function filterNavigationByUser(
    navigation: (NavItem | NavGroup)[],
    user: UserContext
): (NavItem | NavGroup)[] {
    // Operator sees everything
    if (user.permissions.includes("manage_all")) return navigation;

    const { roleName, permissions } = user;

    const hasPermission = (permission?: string) => {
        if (!permission) return true;
        return permissions.includes(permission);
    };

    const hasRole = (roles?: string[]) => {
        if (!roles || roles.length === 0) return true;
        return roles.includes(roleName);
    };

    const filterItems = (items: NavItem[]): NavItem[] =>
        items
            .filter(item => hasRole(item.roles) && hasPermission(item.permission))
            .map(item => ({
                ...item,
                children: item.children
                    ? item.children.filter(c => hasRole(c.roles) && hasPermission(c.permission))
                    : undefined,
            }));

    return navigation
        .map(item => {
            if (isNavGroup(item)) {
                if (!hasRole(item.roles)) return null;
                const filteredItems = filterItems(item.items);
                if (filteredItems.length === 0) return null;
                return { ...item, items: filteredItems };
            }
            return hasRole(item.roles) && hasPermission(item.permission) ? item : null;
        })
        .filter(Boolean) as (NavItem | NavGroup)[];
}

/**
 * Legacy compatibility — still used in some places
 * @deprecated Use filterNavigationByUser instead
 */
export function filterNavigationByPermissions(
    navigation: (NavItem | NavGroup)[],
    permissions: string[]
): (NavItem | NavGroup)[] {
    return filterNavigationByUser(navigation, { permissions, roleName: "operator", unitType: null });
}

/**
 * Get the correct navigation for a user based on their role AND unitType.
 *
 * Logic:
 *  - Operator (manage_all)  → mainNavigation (full)
 *  - Kasir/Admin with dedicated unit → unit-specific navigation
 *  - Default fallback → generic nav
 */
export function getNavigationForUser(user: UserContext): (NavItem | NavGroup)[] {
    if (user.permissions.includes("manage_all")) {
        return mainNavigation; // Operator: full nav
    }

    let finalNav: (NavItem | NavGroup)[] = [];

    // === KASIR ROUTING ===
    if (user.roleName === "kasir" && user.unitType === "toko") {
        finalNav = filterNavigationByUser(kasirTokoNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType && ["resto_cafe", "resto", "coffe_latar"].includes(user.unitType)) {
        finalNav = filterNavigationByUser(kasirRestoNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType === "barbershop") {
        finalNav = filterNavigationByUser(kasirBarbershopNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType === "playstation") {
        finalNav = filterNavigationByUser(kasirPSNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType === "fitness") {
        finalNav = filterNavigationByUser(kasirFitnessNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType === "fotocopy") {
        finalNav = filterNavigationByUser(kasirFotocopyNavigation, user);
    }
    else if (user.roleName === "kasir" && user.unitType === "laundry") {
        finalNav = filterNavigationByUser(kasirLaundryNavigation, user);
    }
    // Kasir unit jasa lain (fallback ke generic)
    else if (user.roleName === "kasir" && user.unitType) {
        finalNav = filterNavigationByUser(kasirNavigation, user);
    }
    // === ADMIN ROUTING ===
    else if (user.roleName === "admin" && user.unitType && ["resto_cafe", "resto", "coffe_latar"].includes(user.unitType)) {
        finalNav = filterNavigationByUser(adminRestoNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "toko") {
        finalNav = filterNavigationByUser(adminTokoNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "barbershop") {
        finalNav = filterNavigationByUser(adminBarbershopNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "playstation") {
        finalNav = filterNavigationByUser(adminPSNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "fitness") {
        finalNav = filterNavigationByUser(adminFitnessNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "fotocopy") {
        finalNav = filterNavigationByUser(adminFotocopyNavigation, user);
    }
    else if (user.roleName === "admin" && user.unitType === "laundry") {
        finalNav = filterNavigationByUser(adminLaundryNavigation, user);
    }
    // Admin unit Jasa Cepat (fallback ke generic)
    else if (user.roleName === "admin" && user.unitType && !["toko", "resto_cafe", "resto", "coffe_latar", "simpan_pinjam", "investasi_modal_jp"].includes(user.unitType)) {
        finalNav = filterNavigationByUser(adminUnitNavigation, user);
    }
    // Default: operator koperasi pusat atau admin pusat (tanpa unitType)
    else {
        finalNav = filterNavigationByUser(mainNavigation, user);
    }

    // Rewrite dynamic variables e.g. [unitSlug] using unitType
    if (user.unitType) {
        const rewriteItem = (item: NavItem): NavItem => ({
            ...item,
            href: item.href.replace('[unitSlug]', user.unitType!.replace(/_/g, '-')),
            children: item.children?.map(rewriteItem)
        });

        finalNav = finalNav.map(item => {
            if (isNavGroup(item)) {
                return {
                    ...item,
                    items: item.items.map(rewriteItem)
                };
            }
            return rewriteItem(item);
        });
    }

    return finalNav;
}
