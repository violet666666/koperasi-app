import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { registerForPushNotificationsAsync } from '../../lib/notifications';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function DashboardScreen({ setToken }: any) {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [dashStats, setDashStats] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userData = await SecureStore.getItemAsync('userData');
      if (userData) setUser(JSON.parse(userData));
    } catch (err) {
      console.log('Error reading user data:', err);
    }

    // Fetch summary data
    try {
      const summaryRes = await api.get('/api/mobile/summary');
      const d = summaryRes.data.data;
      setData(d);
      if (d.type === 'operator' && d.today) {
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
      console.log('Dashboard fetch error:', err?.response?.status, err?.response?.data?.message || err?.message);
      if (err.response?.status === 401) {
        await SecureStore.deleteItemAsync('userToken');
        setToken(null);
        return;
      }
    }

    // Fetch announcements
    try {
      const annRes = await api.get('/api/mobile/pengumuman?limit=3');
      setAnnouncements(annRes.data.data || []);
    } catch (err) {
      console.log('Pengumuman fetch error:', err);
    }
  }, [setToken]);

  useEffect(() => { 
    loadData(); 
    // Minta izin Push Notifications hanya setelah user masuk ke Dashboard (terautentikasi)
    registerForPushNotificationsAsync();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isOperator = data?.type === 'operator';
  const isKasir = data?.type === 'kasir';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <Text style={styles.greeting}>Selamat Datang,</Text>
        <Text style={styles.userName}>{data?.user?.name || user?.name || 'Pengguna'}</Text>
        <Text style={styles.userRole}>{data?.user?.roleDisplayName || user?.roleDisplayName || ''}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* OPERATOR */}
        {isOperator && (
          <>
            <Text style={styles.sectionTitle}>Ringkasan Koperasi</Text>
            <View style={styles.cardRow}>
              <StatCard label="Total Anggota" value={String(dashStats?.activeMembers ?? '...')} icon="👥" color={C.info} />
              <StatCard label="Total Simpanan" value={dashStats ? formatRp(dashStats.totalSavings) : '...'} icon="💰" color={C.success} />
            </View>
            <View style={styles.cardRow}>
              <StatCard label="Pinjaman Aktif" value={dashStats ? formatRp(dashStats.totalLoansOutstanding) : '...'} icon="💳" color={C.accent} />
              <StatCard label="Tunggakan" value={dashStats ? formatRp(dashStats.totalArrears) : '...'} icon="⚠️" color={C.destructive} />
            </View>
            <View style={styles.cardRow}>
              <StatCard label="Total Tunkin" value={dashStats ? formatRp(dashStats.totalTunkin) : '...'} icon="🏅" color={C.secondary} subtitle={`${dashStats?.membersWithTunkin ?? 0} anggota`} />
              <StatCard label="Pending Approval" value={String(dashStats?.pendingApprovals ?? 0)} icon="📋" color={C.warning} />
            </View>

            <Text style={styles.sectionTitle}>Aktivitas Hari Ini</Text>
            <View style={styles.todayCard}>
              <TodayRow emoji="💰" label="Simpanan Masuk" amount={dashStats?.todayDeposits ?? 0} count={dashStats?.todayDepositsCount ?? 0} unit="transaksi" color={C.success} />
              <View style={styles.divider} />
              <TodayRow emoji="📤" label="Pencairan" amount={dashStats?.todayWithdrawals ?? 0} count={dashStats?.todayWithdrawalsCount ?? 0} unit="pencairan" color={C.info} />
              <View style={styles.divider} />
              <TodayRow emoji="💳" label="Angsuran Masuk" amount={dashStats?.todayPayments ?? 0} count={dashStats?.todayPaymentsCount ?? 0} unit="pembayaran" color={C.accent} />
            </View>

            <Text style={styles.sectionTitle}>Aksi Cepat</Text>
            <QuickAction icon="person-add-outline" label="Tambah Anggota" desc="Daftarkan anggota baru" onPress={() => navigation.navigate('Member')} />
            <QuickAction icon="card-outline" label="Transaksi Simpanan" desc="Catat setoran atau penarikan" onPress={() => navigation.navigate('SavingsTransaction')} />
            <QuickAction icon="cash-outline" label="Input Angsuran" desc="Catat pembayaran angsuran" onPress={() => navigation.navigate('LoanPayment')} />
            
            <Text style={styles.sectionTitle}>Laporan Pimpinan</Text>
            <QuickAction icon="pie-chart-outline" label="Rekap Pinjaman" desc="Lihat kolektibilitas & pinjaman" onPress={() => navigation.navigate('LaporanPinjaman')} />
            <QuickAction icon="wallet-outline" label="Rekap Simpanan" desc="Lihat saldo & aktivitas simpanan" onPress={() => navigation.navigate('LaporanSimpanan')} />
          </>
        )}

        {/* MEMBER */}
        {!isOperator && data && (
          <>
            <Text style={styles.sectionTitle}>Keuangan Saya</Text>
            <View style={styles.cardRow}>
              <StatCard label="Total Simpanan" value={formatRp(data.savings?.totalBalance || 0)} icon="💰" color={C.success} />
              <StatCard label="Sisa Pinjaman" value={formatRp(data.loans?.totalOutstanding || 0)} icon="💳" color={C.destructive} />
            </View>
            <View style={styles.cardRow}>
              <StatCard label="Pinjaman Aktif" value={String(data.loans?.activeCount || 0)} icon="📊" color={C.info} />
              <StatCard label="Kredit Belum Lunas" value={formatRp(data.unitCredit?.unpaidTotal || 0)} icon="🛒" color={C.warning} />
            </View>

            {data.savings?.accounts?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Rekening Simpanan</Text>
                {data.savings.accounts.map((acc: any) => (
                  <View key={acc.id} style={styles.accountCard}>
                    <View>
                      <Text style={styles.accountName}>{acc.product?.name || 'Simpanan'}</Text>
                      <Text style={styles.accountNo}>{acc.accountNo}</Text>
                    </View>
                    <Text style={styles.accountBalance}>{formatRp(acc.balance)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* KASIR */}
        {isKasir && data && (
          <>
            <Text style={styles.sectionTitle}>Ringkasan Kasir Hari Ini</Text>
            <View style={styles.cardRow}>
              <StatCard label="Total Penjualan" value={formatRp(data.today?.salesTotal || 0)} icon="🛒" color={C.success} subtitle={`${data.today?.salesCount || 0} transaksi`} />
            </View>

            <Text style={styles.sectionTitle}>5 Transaksi Terakhir</Text>
            {data.latestSales && data.latestSales.length > 0 ? (
              data.latestSales.map((sale: any) => (
                <View key={sale.id} style={styles.salesCard}>
                  <View style={styles.salesRow}>
                    <Text style={styles.salesNo}>{sale.saleNo}</Text>
                    <Text style={styles.salesTime}>{new Date(sale.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={styles.salesRow}>
                    <Text style={styles.salesMethod}>{sale.paymentMethod === 'cash' ? 'Tunai' : 'Kredit'}</Text>
                    <Text style={styles.salesAmount}>{formatRp(sale.totalAmount)}</Text>
                  </View>
                  <Text style={styles.salesItems}>{sale.itemCount} Item</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: C.mutedForeground, textAlign: 'center', marginTop: 10 }}>Belum ada transaksi hari ini</Text>
            )}
          </>
        )}

        {/* PENGUMUMAN */}
        {announcements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📢 Pengumuman</Text>
            {announcements.map((a) => (
              <View key={a.id} style={styles.announcementCard}>
                <Text style={styles.announcementTitle}>{a.title}</Text>
                <Text style={styles.announcementContent} numberOfLines={2}>{a.content}</Text>
                <Text style={styles.announcementDate}>
                  {new Date(a.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color, subtitle }: { label: string; value: string; icon: string; color: string; subtitle?: string }) {
  return (
    <View style={[cs.stat, { borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={cs.statLabel}>{label}</Text>
          <Text style={cs.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
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
      <Text style={cs.todayLabel}>{emoji} {label}</Text>
      <Text style={[cs.todayValue, { color }]}>{formatRp(amount)}</Text>
      <Text style={cs.todayCount}>{count} {unit}</Text>
    </View>
  );
}

function QuickAction({ icon, label, desc, onPress }: { icon: any; label: string; desc: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={cs.quickAction} onPress={onPress}>
      <View style={cs.quickIcon}>
        <Ionicons name={icon} size={20} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cs.quickLabel}>{label}</Text>
        <Text style={cs.quickDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  greeting: { color: C.mutedForeground, fontSize: 14 },
  userName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  userRole: { color: C.accent, fontSize: 13, fontWeight: '500', marginTop: 4 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 20, marginBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  todayCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  divider: { height: 1, backgroundColor: C.border },
  accountCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  accountName: { fontSize: 14, fontWeight: '600', color: C.primary },
  accountNo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: 'bold', color: C.success },
  announcementCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: C.accent,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 4 },
  announcementContent: { fontSize: 13, color: C.mutedForeground, lineHeight: 20 },
  announcementDate: { fontSize: 11, color: C.mutedForeground, marginTop: 8 },
  salesCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: C.info,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  salesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  salesNo: { fontSize: 13, fontWeight: '600', color: C.primary },
  salesTime: { fontSize: 11, color: C.mutedForeground },
  salesMethod: { fontSize: 12, color: C.mutedForeground, textTransform: 'uppercase' },
  salesAmount: { fontSize: 15, fontWeight: 'bold', color: C.success },
  salesItems: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
});

const cs = StyleSheet.create({
  stat: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 'bold', color: C.foreground },
  statSub: { fontSize: 10, color: C.mutedForeground, marginTop: 2 },
  todayRow: { paddingVertical: 12 },
  todayLabel: { fontSize: 14, color: C.foreground, fontWeight: '600' },
  todayValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  todayCount: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  quickAction: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  quickIcon: { backgroundColor: C.accentBg, padding: 10, borderRadius: 10 },
  quickLabel: { fontSize: 14, fontWeight: '600', color: C.primary },
  quickDesc: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
});
