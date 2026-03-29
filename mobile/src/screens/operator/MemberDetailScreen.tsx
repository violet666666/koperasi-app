import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function MemberDetailScreen({ route, navigation }: any) {
  const { memberId, memberName } = route?.params || {};
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/mobile/members/${memberId}`);
        setData(res.data.data);
      } catch (err) {
        console.log('Failed to load member detail:', err);
      } finally {
        setLoading(false);
      }
    };
    if (memberId) load();
  }, [memberId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Detail Anggota</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.emptyText}>Data anggota tidak ditemukan</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color="#FFF" />
            </View>
            <Text style={styles.name}>{data.name || memberName}</Text>
            <Text style={styles.nrp}>NRP: {data.nrp || '-'}</Text>
            {data.category && <Text style={styles.category}>{data.category}</Text>}
          </View>

          {/* Info Section */}
          <Text style={styles.sectionTitle}>Informasi Pribadi</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="id-card-outline" label="No. Anggota" value={data.memberNo || '-'} />
            <InfoRow icon="mail-outline" label="Email" value={data.email || '-'} />
            <InfoRow icon="call-outline" label="Telepon" value={data.phone || '-'} />
            <InfoRow icon="ribbon-outline" label="Kategori" value={data.category || '-'} />
            <InfoRow icon="briefcase-outline" label="Pekerjaan" value={data.occupation || '-'} />
            <InfoRow icon="calendar-outline" label="Tgl Bergabung" value={data.joinDate ? new Date(data.joinDate).toLocaleDateString('id-ID') : '-'} last />
          </View>

          {/* Financial Section */}
          <Text style={styles.sectionTitle}>Informasi Keuangan</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="cash-outline" label="Gaji Pokok" value={formatRp(data.salary)} />
            <InfoRow icon="medal-outline" label="Tunkin" value={formatRp(data.tunlesKinerja)} />
            <InfoRow icon="wallet-outline" label="Total Simpanan" value={formatRp(data.totalSavings)} />
            <InfoRow icon="card-outline" label="Pinjaman Aktif" value={formatRp(data.totalLoansOutstanding)} last />
          </View>

          {/* Savings Accounts */}
          {data.savingsAccounts?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Rekening Simpanan</Text>
              {data.savingsAccounts.map((acc: any) => (
                <View key={acc.id} style={styles.accountRow}>
                  <View>
                    <Text style={styles.accountName}>{acc.product?.name || 'Simpanan'}</Text>
                    <Text style={styles.accountNo}>{acc.accountNo}</Text>
                  </View>
                  <Text style={styles.accountBalance}>{formatRp(acc.balance)}</Text>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Action Buttons (Sticky Footer) */}
      {!loading && data && (
        <View style={styles.actionFooter}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: C.accent }]}
            onPress={() => navigation.navigate('SavingsTransaction', { memberId: data.id, memberName: data.name })}
          >
            <Ionicons name="card-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Simpanan</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: C.success }]}
            onPress={() => navigation.navigate('LoanPayment', { memberId: data.id, memberName: data.name })}
          >
            <Ionicons name="cash-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Angsuran</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: C.background }]}>
      <Ionicons name={icon} size={18} color={C.mutedForeground} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: C.mutedForeground },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  nrp: { fontSize: 14, color: C.accent, fontWeight: '600', marginTop: 4 },
  category: { fontSize: 12, color: C.mutedForeground, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: C.mutedForeground, marginTop: 20, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  infoLabel: { flex: 1, fontSize: 14, color: C.foreground },
  infoValue: { fontSize: 14, color: C.mutedForeground, fontWeight: '500', maxWidth: '50%', textAlign: 'right' },
  accountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  accountName: { fontSize: 14, fontWeight: '600', color: C.primary },
  accountNo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: 'bold', color: C.success },
  actionFooter: {
    padding: 16, backgroundColor: C.card, flexDirection: 'row', gap: 12,
    borderTopWidth: 1, borderTopColor: C.border, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});
