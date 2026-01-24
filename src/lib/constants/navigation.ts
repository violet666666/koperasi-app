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
                href: "/jurnal",
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
                    { title: "SHU", href: "/laporan/shu" },
                    { title: "Rekap Simpanan", href: "/laporan/rekap-simpanan" },
                    { title: "Rekap Pinjaman", href: "/laporan/rekap-pinjaman" },
                    { title: "Penyusutan Aset", href: "/laporan/penyusutan" },
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
                href: "/tutup-buku",
                icon: Lock,
                permission: "tutup_buku",
            },
            {
                title: "Alokasi SHU",
                href: "/shu",
                icon: PieChart,
                permission: "alokasi_shu",
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
                    { title: "Cabang", href: "/master/cabang" },
                    { title: "Produk Simpanan", href: "/master/produk-simpanan" },
                    { title: "Produk Pinjaman", href: "/master/produk-pinjaman" },
                    { title: "Chart of Accounts", href: "/master/coa" },
                    { title: "Mapping Jurnal", href: "/master/mapping-jurnal" },
                    { title: "Parameter SHU", href: "/master/parameter-shu" },
                    { title: "Saldo Awal", href: "/master/saldo-awal" },
                ],
            },
            {
                title: "User Management",
                href: "/users",
                icon: UserCog,
                permission: "user_management",
            },
            {
                title: "Profil Koperasi",
                href: "/profil-koperasi",
                icon: Building2,
                permission: "edit_profil",
            },
            {
                title: "Pengaturan",
                href: "/settings",
                icon: Settings,
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
