// Navigation configuration for the Koperasi Digital application

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
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon;
    permission?: string;
    badge?: string; // Key for dynamic badge count
    children?: NavItem[];
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export const mainNavigation: (NavItem | NavGroup)[] = [
    // Dashboard
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },

    // OPERASIONAL
    {
        title: "OPERASIONAL",
        items: [
            {
                title: "Anggota",
                href: "/anggota",
                icon: Users,
                permission: "manage_anggota",
                children: [
                    { title: "Daftar Anggota", href: "/anggota" },
                    { title: "Kartu Anggota", href: "/anggota/kartu" },
                    { title: "Buku Anggota", href: "/anggota/buku" },
                ],
            },
            {
                title: "Simpanan",
                href: "/simpanan",
                icon: Wallet,
                permission: "manage_simpanan",
                children: [
                    { title: "Rekening Anggota", href: "/simpanan/rekening" },
                    { title: "Transaksi Simpanan", href: "/simpanan/transaksi" },
                    { title: "Rekap Simpanan", href: "/simpanan/rekap" },
                ],
            },
            {
                title: "Pinjaman",
                href: "/pinjaman",
                icon: CreditCard,
                permission: "manage_pinjaman",
                children: [
                    { title: "Pengajuan", href: "/pinjaman/pengajuan" },
                    { title: "Daftar Pinjaman", href: "/pinjaman" },
                    { title: "Angsuran", href: "/pinjaman/angsuran" },
                    { title: "Jadwal Angsuran", href: "/pinjaman/jadwal" },
                ],
            },
            {
                title: "Kas & Bank",
                href: "/kas-bank",
                icon: Building,
                permission: "manage_kas_bank",
                children: [
                    { title: "Buku Kas", href: "/kas-bank/buku-kas" },
                    { title: "Transaksi Kas", href: "/kas-bank/kas" },
                    { title: "Transaksi Bank", href: "/kas-bank/bank" },
                    { title: "Transfer", href: "/kas-bank/transfer" },
                ],
            },
            {
                title: "Non Simpan Pinjam",
                href: "/non-sp",
                icon: ArrowLeftRight,
                permission: "manage_kas_bank",
                children: [
                    { title: "Penerimaan", href: "/non-sp/penerimaan" },
                    { title: "Pengeluaran", href: "/non-sp/pengeluaran" },
                ],
            },
            {
                title: "Transaksi Unit Layanan",
                href: "/transaksi-unit",
                icon: Wallet,
                permission: "manage_unit_transactions",
                children: [
                    { title: "Kasir Cepat", href: "/unit-layanan/kasir", permission: "kasir_pos" },
                    { title: "Piutang & Riwayat", href: "/transaksi-unit" },
                ],
            },
            {
                title: "Kwitansi",
                href: "/kwitansi",
                icon: Receipt,
                permission: "manage_unit_transactions",
            },
        ],
    },

    // AKUNTANSI
    {
        title: "AKUNTANSI",
        items: [
            {
                title: "Aset",
                href: "/aset",
                icon: Package,
                permission: "manage_aset",
                children: [
                    { title: "Daftar Aset", href: "/aset" },
                    { title: "Penyusutan", href: "/aset/penyusutan" },
                ],
            },
            {
                title: "Jurnal",
                href: "/jurnal/umum",
                icon: BookOpen,
                permission: "view_jurnal",
                children: [
                    { title: "Buku Besar", href: "/jurnal/buku-besar" },
                    { title: "Jurnal Umum", href: "/jurnal/umum" },
                    { title: "Jurnal Penyesuaian", href: "/jurnal/penyesuaian" },
                ],
            },
            {
                title: "Laporan",
                href: "/laporan",
                icon: FileText,
                permission: "view_laporan",
                children: [
                    { title: "Neraca", href: "/laporan/neraca" },
                    { title: "Laba Rugi", href: "/laporan/laba-rugi" },
                    { title: "Arus Kas", href: "/laporan/arus-kas" },
                    { title: "SHU", href: "/laporan/shu" },
                    { title: "Rekap Simpanan", href: "/laporan/rekap-simpanan" },
                    { title: "Rekap Pinjaman", href: "/laporan/rekap-pinjaman" },
                ],
            },
        ],
    },

    // PERIODE & SHU
    {
        title: "PERIODE & SHU",
        items: [
            {
                title: "Tutup Buku",
                href: "/periode/tutup-buku",
                icon: Lock,
                permission: "tutup_buku",
            },
            {
                title: "Alokasi SHU",
                href: "/periode/shu/perhitungan",
                icon: PieChart,
                permission: "alokasi_shu",
                children: [
                    { title: "Perhitungan", href: "/periode/shu/perhitungan" },
                    { title: "Distribusi", href: "/periode/shu/distribusi" },
                ],
            },
        ],
    },

    // TOKO
    {
        title: "TOKO",
        items: [
            {
                title: "Toko PRIMKOPPOL",
                href: "/toko",
                icon: ShoppingBag,
                permission: "manage_toko",
                children: [
                    { title: "Produk", href: "/toko/produk" },
                    { title: "Kasir / POS", href: "/toko/kasir" },
                    { title: "Persediaan", href: "/toko/persediaan" },
                ],
            },
        ],
    },

    // KOMUNIKASI
    {
        title: "KOMUNIKASI",
        items: [
            {
                title: "Pengumuman",
                href: "/pengumuman",
                icon: Megaphone,
                permission: "manage_pengumuman",
            },
        ],
    },

    // APPROVAL
    {
        title: "APPROVAL",
        items: [
            {
                title: "Inbox Approval",
                href: "/approval",
                icon: CheckSquare,
                permission: "approve_transactions",
                badge: "pending_approval_count",
            },
            {
                title: "Audit Log",
                href: "/audit-log",
                icon: Activity,
                permission: "view_audit_log",
            },
        ],
    },

    // PENGATURAN
    {
        title: "PENGATURAN",
        items: [
            {
                title: "Master Data",
                href: "/master",
                icon: Database,
                permission: "master_data",
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
                title: "User Management",
                href: "/master/users",
                icon: UserCog,
                permission: "user_management",
            },
            {
                title: "Profil PRIMKOPPOL",
                href: "/profil-koperasi",
                icon: Building2,
                permission: "edit_profil",
            },
            {
                title: "Pengaturan",
                href: "/settings",
                icon: Settings,
            },
            {
                title: "Profil Saya",
                href: "/profil",
                icon: User,
            },
        ],
    },
];

// Bottom navigation for mobile
export const bottomNavigation: NavItem[] = [
    {
        title: "Beranda",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Anggota",
        href: "/anggota",
        icon: Users,
    },
    {
        title: "Simpanan",
        href: "/simpanan",
        icon: Wallet,
    },
    {
        title: "Pinjaman",
        href: "/pinjaman",
        icon: CreditCard,
    },
];

// Helper function to check if a nav item is a group
export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
    return "items" in item;
}

// Helper function to get all flat nav items for search/command
export function getAllNavItems(
    navigation: (NavItem | NavGroup)[]
): NavItem[] {
    const items: NavItem[] = [];

    for (const item of navigation) {
        if (isNavGroup(item)) {
            for (const subItem of item.items) {
                items.push(subItem);
                if (subItem.children) {
                    items.push(...subItem.children);
                }
            }
        } else {
            items.push(item);
            if (item.children) {
                items.push(...item.children);
            }
        }
    }

    return items;
}

// Filter navigation items based on user permissions
export function filterNavigationByPermissions(
    navigation: (NavItem | NavGroup)[],
    permissions: string[]
): (NavItem | NavGroup)[] {
    // Super admin sees everything
    if (permissions.includes("manage_all")) return navigation;

    const hasAccess = (permission?: string) => {
        if (!permission) return true; // No permission = public
        return permissions.includes(permission);
    };

    const filterItems = (items: NavItem[]): NavItem[] => {
        return items
            .filter((item) => hasAccess(item.permission))
            .map((item) => ({
                ...item,
                children: item.children
                    ? item.children.filter((child) => hasAccess(child.permission))
                    : undefined,
            }));
    };

    return navigation
        .map((item) => {
            if (isNavGroup(item)) {
                const filteredItems = filterItems(item.items);
                if (filteredItems.length === 0) return null;
                return { ...item, items: filteredItems };
            }
            return hasAccess(item.permission) ? item : null;
        })
        .filter(Boolean) as (NavItem | NavGroup)[];
}

