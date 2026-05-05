import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { StorageManager } from "../../lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { registerForPushNotificationsAsync } from "../../lib/notifications";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const CollapsibleSection = ({ title, children, defaultExpanded = false, icon }: { title: string, children: any, defaultExpanded?: boolean, icon: string }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={{ marginBottom: 12, backgroundColor: "white", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" }}>
       <TouchableOpacity 
          style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: expanded ? 1 : 0, borderBottomColor: "#f1f5f9" }} 
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
       >
          <View style={{ backgroundColor: C.primary + "1A", padding: 8, borderRadius: 8, marginRight: 12 }}>
             <Ionicons name={icon as any} size={20} color={C.primary} />
          </View>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "bold", color: C.foreground }}>{title}</Text>
          <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={20} color={C.mutedForeground} />
       </TouchableOpacity>
       {expanded && (
          <View style={{ padding: 16, backgroundColor: "#f8fafc" }}>
             {children}
          </View>
       )}
    </View>
  )
}

export default function DashboardScreen({ setToken }: any) {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [dashStats, setDashStats] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userData = StorageManager.getFastString("userData");
      if (userData) setUser(JSON.parse(userData));
    } catch (err) {
      console.log("Error reading user data:", err);
    }

    try {
      const summaryRes = await api.get("/api/mobile/summary");
      const d = summaryRes.data.data;
      setData(d);
      if (d.type === "operator" && d.today) {
        setDashStats({
          totalSavings: d.stats.totalSavings,
          totalLoansOutstanding: d.stats.totalLoansOutstanding,
          totalArrears: d.stats.totalArrears,
          activeMembers: d.stats.totalMembers,
          pendingApprovals: d.stats.pendingApprovals,
          totalTunkin: d.stats.totalTunkin,
          membersWithTunkin: d.stats.membersWithTunkin,
          todayDeposits: d.today.deposits,
          todayDepositsCount: d.today.depositsCount,
          todayWithdrawals: d.today.withdrawals,
          todayWithdrawalsCount: d.today.withdrawalsCount,
          todayPayments: d.today.payments,
          todayPaymentsCount: d.today.paymentsCount,
        });
      }
    } catch (err: any) {
      console.log(
        "Dashboard fetch error:",
        err?.response?.status,
        err?.response?.data?.message || err?.message,
      );
      if (err.response?.status === 401) {
        await StorageManager.deleteSecureItem("userToken");
        setToken(null);
        return;
      }
    }

    try {
      const annRes = await api.get("/api/mobile/pengumuman?limit=3");
      setAnnouncements(annRes.data.data || []);
    } catch (err) {
      console.log("Pengumuman fetch error:", err);
    }
  }, [setToken]);

  useEffect(() => {
    loadData();
    registerForPushNotificationsAsync();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isOperator = data?.type === "operator";
  const isKasir = data?.type === "kasir";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Selamat Datang,</Text>
            <Text style={styles.userName}>
              {data?.user?.name || user?.name || "Pengguna"}
            </Text>
            <Text style={styles.userRole}>
              {data?.user?.roleDisplayName || user?.roleDisplayName || ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate("Pengumuman")}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
            {announcements.length > 0 && <View style={styles.notifBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ===== OPERATOR DASHBOARD ===== */}
        {isOperator && (
          <>
            <Text style={styles.sectionTitle}>Ringkasan PRIMKOPPOL</Text>
            <View style={styles.cardRow}>
              <StatCard
                label="Total Anggota"
                value={String(dashStats?.activeMembers ?? "...")}
                icon="👥"
                color={C.info}
              />
              <StatCard
                label="Total Simpanan"
                value={dashStats ? formatRp(dashStats.totalSavings) : "..."}
                icon="💰"
                color={C.success}
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="Pinjaman Aktif"
                value={
                  dashStats ? formatRp(dashStats.totalLoansOutstanding) : "..."
                }
                icon="💳"
                color={C.accent}
              />
              <StatCard
                label="Tunggakan"
                value={dashStats ? formatRp(dashStats.totalArrears) : "..."}
                icon="⚠️"
                color={C.destructive}
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="Total Tunkin"
                value={dashStats ? formatRp(dashStats.totalTunkin) : "..."}
                icon="🏅"
                color={C.secondary}
                subtitle={`${dashStats?.membersWithTunkin ?? 0} anggota`}
              />
              <StatCard
                label="Pending Approval"
                value={String(dashStats?.pendingApprovals ?? 0)}
                icon="📋"
                color={C.warning}
              />
            </View>

            <Text style={styles.sectionTitle}>Aktivitas Hari Ini</Text>
            <View style={styles.todayCard}>
              <TodayRow
                emoji="💰"
                label="Simpanan Masuk"
                amount={dashStats?.todayDeposits ?? 0}
                count={dashStats?.todayDepositsCount ?? 0}
                unit="transaksi"
                color={C.success}
              />
              <View style={styles.divider} />
              <TodayRow
                emoji="📤"
                label="Pencairan"
                amount={dashStats?.todayWithdrawals ?? 0}
                count={dashStats?.todayWithdrawalsCount ?? 0}
                unit="pencairan"
                color={C.info}
              />
              <View style={styles.divider} />
              <TodayRow
                emoji="💳"
                label="Angsuran Masuk"
                amount={dashStats?.todayPayments ?? 0}
                count={dashStats?.todayPaymentsCount ?? 0}
                unit="pembayaran"
                color={C.accent}
              />
            </View>

            {/* ACCORDION MENUS */}
            <View style={{ marginTop: 24 }}>
                <CollapsibleSection title="Pusat Kasir & Toko" icon="storefront" defaultExpanded={false}>
                    <View style={styles.menuGrid}>
                        <MenuItem icon="cart-outline" label="Kasir POS" color="#F59E0B" onPress={() => navigation.navigate("KasirFull")} />
                        <MenuItem icon="cube-outline" label="Stok Barang" color="#0284c7" onPress={() => navigation.navigate("StokFull")} />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Anggota & Simpan-Pinjam" icon="people" defaultExpanded={true}>
                    <View style={styles.menuGrid}>
                        <MenuItem icon="people-outline" label="Buku Anggota" color={C.info} onPress={() => navigation.navigate("MemberListFull")} />
                        <MenuItem icon="albums-outline" label="Rekening" color={C.accent} onPress={() => navigation.navigate("RekeningList")} />
                        <MenuItem icon="checkmark-circle-outline" label="Persetujuan" color="#10B981" onPress={() => navigation.navigate("ApprovalFull")} />
                        <MenuItem icon="cash-outline" label="Bayar Angsuran" color={C.success} onPress={() => navigation.navigate("MemberListFull")} />
                        <MenuItem icon="list-outline" label="Daftar Pinjam" color="#7C3AED" onPress={() => navigation.navigate("DaftarPinjaman")} />
                        <MenuItem icon="flash-outline" label="Cairkan Lgsg" color="#EF4444" onPress={() => navigation.navigate("DirectDisburse")} />
                        <MenuItem icon="swap-horizontal-outline" label="Kompen" color="#7C3AED" onPress={() => navigation.navigate("Kompen")} />
                        <MenuItem icon="document-text-outline" label="Gaji & Payroll" color="#7C3AED" onPress={() => navigation.navigate("GajiPeriode")} />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Akuntansi & Keuangan" icon="calculator" defaultExpanded={false}>
                    <View style={styles.menuGrid}>
                        <MenuItem icon="card-outline" label="Kas & Bank" color="#10B981" onPress={() => navigation.navigate("KasBankFull")} />
                        <MenuItem icon="wallet-outline" label="Buku Kas" color="#0ea5e9" onPress={() => navigation.navigate("BukuKasList")} />
                        <MenuItem icon="receipt-outline" label="Kwitansi" color="#f97316" onPress={() => navigation.navigate("KwitansiList")} />
                        <MenuItem icon="book-outline" label="Jurnal Umum" color="#0284c7" onPress={() => navigation.navigate("JurnalDaftar")} />
                        <MenuItem icon="library-outline" label="Buku Besar" color="#4338ca" onPress={() => navigation.navigate("BukuBesar")} />
                        <MenuItem icon="bar-chart-outline" label="Laba Rugi" color="#10B981" onPress={() => navigation.navigate("LabaRugi")} />
                        <MenuItem icon="scale-outline" label="Neraca" color="#D97706" onPress={() => navigation.navigate("Neraca")} />
                        <MenuItem icon="pie-chart-outline" label="Simulasi SHU" color="#be185d" onPress={() => navigation.navigate("LaporanSHU")} />
                        <MenuItem icon="car-wash" label="Lap. Cuci Mobil" color="#0E7490" onPress={() => navigation.navigate("LaporanCuciMobil")} />
                        <MenuItem icon="server-outline" label="Aset PRIMKOPPOL" color="#0891b2" onPress={() => navigation.navigate("AsetList")} />
                    </View>
                </CollapsibleSection>

                <CollapsibleSection title="Administrasi Sistem" icon="settings" defaultExpanded={false}>
                    <View style={styles.menuGrid}>
                        <MenuItem icon="options" label="Master Data" color="#ea580c" onPress={() => navigation.navigate("MasterDataHub")} />
                        <MenuItem icon="cloud-upload-outline" label="Import Data" color="#16a34a" onPress={() => navigation.navigate("ImportData")} />
                        <MenuItem icon="notifications-outline" label="Notifikasi" color="#EA580C" onPress={() => navigation.navigate("Notifikasi")} />
                        <MenuItem icon="megaphone-outline" label="Pengumuman" color="#F59E0B" onPress={() => navigation.navigate("Pengumuman")} />
                        <MenuItem icon="list-circle-outline" label="Audit Log" color="#64748B" onPress={() => navigation.navigate("AuditLogFull")} />
                        <MenuItem icon="business-outline" label="Profil Usaha" color="#0F766E" onPress={() => navigation.navigate("ProfilKoperasi")} />
                        <MenuItem icon="key-outline" label="Ganti Sandi" color="#6B7280" onPress={() => navigation.navigate("ChangePassword")} />
                    </View>
                </CollapsibleSection>
            </View>
          </>
        )}

        {/* ===== KASIR DASHBOARD ===== */}
        {isKasir && (
          <>
            <Text style={styles.sectionTitle}>Ringkasan Kasir Hari Ini</Text>
            <View style={styles.cardRow}>
              <StatCard
                label="Total Penjualan"
                value={formatRp(data.today?.salesTotal || 0)}
                icon="🛒"
                color={C.success}
                subtitle={`${data.today?.salesCount || 0} transaksi`}
              />
            </View>

            <Text style={styles.sectionTitle}>5 Transaksi Terakhir</Text>
            {data.latestSales && data.latestSales.length > 0 ? (
              data.latestSales.map((sale: any) => (
                <View key={sale.id} style={styles.salesCard}>
                  <View style={styles.salesRow}>
                    <Text style={styles.salesNo}>{sale.saleNo}</Text>
                    <Text style={styles.salesTime}>
                      {new Date(sale.timestamp).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.salesRow}>
                    <Text style={styles.salesMethod}>
                      {sale.paymentMethod === "cash" ? "Tunai" : "Kredit"}
                    </Text>
                    <Text style={styles.salesAmount}>
                      {formatRp(sale.totalAmount)}
                    </Text>
                  </View>
                  <Text style={styles.salesItems}>{sale.itemCount} Item</Text>
                </View>
              ))
            ) : (
              <Text
                style={{
                  color: C.mutedForeground,
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                Belum ada transaksi hari ini
              </Text>
            )}

            {/* KASIR MENU */}
            <Text style={styles.sectionTitle}>Menu Kasir</Text>
            <View style={styles.menuGrid}>
              <MenuItem
                icon="cart-outline"
                label="Kasir/POS"
                color={C.accent}
                onPress={() => navigation.navigate("KasirFull")}
              />
              <MenuItem
                icon="cube-outline"
                label="Stok Barang"
                color={C.info}
                onPress={() => navigation.navigate("StokFull")}
              />
              <MenuItem
                icon="megaphone-outline"
                label="Pengumuman"
                color="#F59E0B"
                onPress={() => navigation.navigate("Pengumuman")}
              />
              <MenuItem
                icon="key-outline"
                label="Ganti Password"
                color="#6B7280"
                onPress={() => navigation.navigate("ChangePassword")}
              />
            </View>
          </>
        )}

        {/* ===== ANGGOTA/MEMBER DASHBOARD ===== */}
        {!isOperator && !isKasir && data && (
          <>
            <Text style={styles.sectionTitle}>Keuangan Saya</Text>
            <View style={styles.cardRow}>
              <StatCard
                label="Total Simpanan"
                value={formatRp(data.savings?.totalBalance || 0)}
                icon="💰"
                color={C.success}
              />
              <StatCard
                label="Sisa Pinjaman"
                value={formatRp(data.loans?.totalOutstanding || 0)}
                icon="💳"
                color={C.destructive}
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="Pinjaman Aktif"
                value={String(data.loans?.activeCount || 0)}
                icon="📊"
                color={C.info}
              />
              <StatCard
                label="Kredit Belum Lunas"
                value={formatRp(data.unitCredit?.unpaidTotal || 0)}
                icon="🛒"
                color={C.warning}
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="SISA TUNKIN"
                value={formatRp(data.member?.tunlesKinerja || 0)}
                icon="🏅"
                color={C.secondary}
              />
              <StatCard
                label="Estimasi SHU"
                value={formatRp(data.estimatedSHU || 0)}
                icon="🎉"
                color="#F59E0B"
              />
            </View>
            <View style={styles.cardRow}>
              {(() => {
                // Ambil saldo wajib dari SavingsAccount (Single Source of Truth)
                const wajibAcc = data.savings?.accounts?.find((a: any) => a.product?.type === 'wajib');
                const wajibBalance = wajibAcc ? wajibAcc.balance : 0;
                return (
                  <StatCard
                    label="Simpanan Wajib"
                    value={formatRp(wajibBalance)}
                    icon="💵"
                    color={C.primary}
                  />
                );
              })()}
              <StatCard
                label="Tabungan Sejahtera"
                value={formatRp(data.savings?.sejahteraBalance || 0)}
                icon="🌟"
                color="#0891b2"
              />
            </View>
            <View style={styles.cardRow}>
              <StatCard
                label="Gaji Bersih"
                value={formatRp(data.member?.salary || 0)}
                icon="🏦"
                color={C.success}
              />
            </View>

            {/* === DETAIL TABUNGAN WAJIB BULANAN (Expandable) === */}
            {(() => {
              const wajibAcc = data.savings?.accounts?.find((a: any) => a.product?.type === 'wajib');
              const txs = wajibAcc?.transactions || [];
              const MONTH_NAMES = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
              
              // Pisahkan saldo awal vs setoran bulanan
              const saldoAwalEntries = txs.filter((t: any) => 
                t.notes?.includes('Saldo Wajib Awal') || t.notes?.includes('Saldo Awal') || 
                t.notes?.includes('Import Saldo') || t.notes?.includes('Import/Update Saldo')
              );
              const monthlyEntries = txs.filter((t: any) => !saldoAwalEntries.includes(t));
              const saldoAwal = saldoAwalEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0);

              if (txs.length === 0) return null;

              return (
                <CollapsibleSection title="📊 Detail Tabungan Wajib" icon="wallet" defaultExpanded={false}>
                  {/* Saldo Awal Akumulasi */}
                  {saldoAwal > 0 && (
                    <View style={{ backgroundColor: '#f0fdfa', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#99f6e4' }}>
                      <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '600' }}>💰 Saldo Awal (Akumulasi)</Text>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0d9488', textAlign: 'right', fontFamily: 'monospace' }}>{formatRp(saldoAwal)}</Text>
                    </View>
                  )}

                  {/* Rincian Setoran Per Bulan */}
                  {monthlyEntries.length > 0 && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Rincian Setoran Bulanan</Text>
                      </View>
                      {monthlyEntries.map((entry: any, idx: number) => {
                        let monthLabel = '';
                        if (entry.notes?.startsWith('Setoran Import TAJIB:')) {
                          monthLabel = entry.notes.replace('Setoran Import TAJIB: ', '');
                        } else {
                          const d = new Date(entry.transactionDate);
                          monthLabel = MONTH_NAMES[d.getMonth()] || '';
                        }
                        let prefix = '+';
                        let textColor = '#0d9488';
                        let labelPrefix = '📅';

                        if (entry.type === 'correction') {
                          prefix = '-';
                          textColor = '#EF4444';
                          labelPrefix = '⚠ KOREKSI';
                        } else if (entry.type === 'withdrawal') {
                          prefix = '-';
                          textColor = '#EF4444';
                          labelPrefix = '↩ PENARIKAN';
                        }

                        return (
                          <View key={entry.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#f1f5f9' }}>
                            <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                              {labelPrefix} {monthLabel}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: textColor, fontFamily: 'monospace' }}>
                              {prefix} {formatRp(entry.amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Footer Total */}
                  <View style={{ backgroundColor: '#0f766e', borderRadius: 10, padding: 14, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Total Simpanan Wajib</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>{formatRp(wajibAcc?.balance || 0)}</Text>
                  </View>

                  {/* Catatan AD-ART */}
                  <View style={{ backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#fde68a' }}>
                    <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600', marginBottom: 4 }}>ℹ️ Catatan:</Text>
                    <Text style={{ fontSize: 10, color: '#92400e' }}>• Pokok & Wajib tidak bisa ditarik</Text>
                    <Text style={{ fontSize: 10, color: '#92400e' }}>• Sukarela bisa ditarik kapan saja</Text>
                    <Text style={{ fontSize: 10, color: '#92400e' }}>• Semakin besar simpanan = SHU semakin besar</Text>
                  </View>
                </CollapsibleSection>
              );
            })()}

            {/* REKENING SIMPANAN */}
            {data.savings?.accounts?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Rekening Simpanan</Text>
                {data.savings.accounts.map((acc: any) => (
                  <View key={acc.id} style={styles.accountCard}>
                    <View>
                      <Text style={styles.accountName}>
                        {acc.product?.name || "Simpanan"}
                      </Text>
                      <Text style={styles.accountNo}>{acc.accountNo}</Text>
                    </View>
                    <Text style={styles.accountBalance}>
                      {formatRp(acc.balance)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* ANGGOTA MENU GRID */}
            <Text style={styles.sectionTitle}>Menu Layanan</Text>
            <View style={styles.menuGrid}>
              <MenuItem
                icon="receipt-outline"
                label="Mutasi Transaksi"
                color={C.info}
                onPress={() =>
                  navigation.navigate("Main", { screen: "Transaksi" })
                }
              />
              <MenuItem
                icon="cash-outline"
                label="Pinjaman Saya"
                color={C.accent}
                onPress={() =>
                  navigation.navigate("Main", { screen: "Pinjaman" })
                }
              />
              <MenuItem
                icon="add-circle-outline"
                label="Ajukan Pinjaman"
                color={C.success}
                onPress={() => navigation.navigate("LoanApplication")}
              />
              <MenuItem
                icon="card-outline"
                label="Kartu Anggota"
                color="#8B5CF6"
                onPress={() => navigation.navigate("AnggotaCard")}
              />
              <MenuItem
                icon="megaphone-outline"
                label="Pengumuman"
                color="#F59E0B"
                onPress={() => navigation.navigate("Pengumuman")}
              />
              <MenuItem
                icon="key-outline"
                label="Ganti Password"
                color="#6B7280"
                onPress={() => navigation.navigate("ChangePassword")}
              />
            </View>
          </>
        )}

        {/* PENGUMUMAN TERBARU */}
        {announcements.length > 0 && (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
                📢 Pengumuman Terbaru
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Pengumuman")}
              >
                <Text
                  style={{ color: C.accent, fontSize: 13, fontWeight: "600" }}
                >
                  Lihat Semua
                </Text>
              </TouchableOpacity>
            </View>
            {announcements.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.announcementCard}
                onPress={() =>
                  navigation.navigate("PengumumanDetail", { item: a })
                }
              >
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementContent} numberOfLines={2}>
                  {a.content}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <Text style={styles.announcementDate}>
                    {new Date(a.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={C.mutedForeground}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ========== REUSABLE COMPONENTS ==========

function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <View style={[cs.stat, { borderLeftColor: color }]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={cs.statLabel}>{label}</Text>
          <Text style={cs.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          {subtitle && <Text style={cs.statSub}>{subtitle}</Text>}
        </View>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
    </View>
  );
}

function TodayRow({ emoji, label, amount, count, unit, color }: any) {
  return (
    <View style={cs.todayRow}>
      <Text style={cs.todayLabel}>
        {emoji} {label}
      </Text>
      <Text style={[cs.todayValue, { color }]}>{formatRp(amount)}</Text>
      <Text style={cs.todayCount}>
        {count} {unit}
      </Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  color,
  onPress,
}: {
  icon: any;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={cs.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[cs.menuIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={cs.menuLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ========== STYLES ==========

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: { color: "#94A3B8", fontSize: 14 },
  userName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },
  userRole: { color: C.accent, fontSize: 13, fontWeight: "500", marginTop: 4 },
  notifBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: C.primary,
  },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  todayCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: C.border },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  accountCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  accountName: { fontSize: 14, fontWeight: "600", color: C.primary },
  accountNo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: "bold", color: C.success },
  announcementCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  announcementContent: {
    fontSize: 13,
    color: C.mutedForeground,
    lineHeight: 20,
  },
  announcementDate: { fontSize: 11, color: C.mutedForeground },
  salesCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: C.info,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  salesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  salesNo: { fontSize: 13, fontWeight: "600", color: C.primary },
  salesTime: { fontSize: 11, color: C.mutedForeground },
  salesMethod: {
    fontSize: 12,
    color: C.mutedForeground,
    textTransform: "uppercase",
  },
  salesAmount: { fontSize: 15, fontWeight: "bold", color: C.success },
  salesItems: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
});

const cs = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "bold", color: C.foreground },
  statSub: { fontSize: 10, color: C.mutedForeground, marginTop: 2 },
  todayRow: { paddingVertical: 12 },
  todayLabel: { fontSize: 14, color: C.foreground, fontWeight: "600" },
  todayValue: { fontSize: 20, fontWeight: "bold", marginTop: 4 },
  todayCount: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  menuItem: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.foreground,
    textAlign: "center",
    paddingHorizontal: 4,
  },
});
