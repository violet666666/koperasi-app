import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function LaporanSimpananScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/reports/savings');
      setData(res.data.data);
    } catch (err: any) {
      console.log('Failed to load savings report:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Rekap Simpanan</Text>
        <Text style={styles.headerSubtitle}>Laporan Agregasi Produk Simpanan</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Ringkasan Total</Text>
        
        <View style={styles.statGrid}>
          <View style={styles.cardHeader}>
             <Ionicons name="wallet" size={20} color={C.primary} />
             <Text style={styles.cardHeaderTitle}>Total Saldo Beredar</Text>
          </View>
          <Text style={styles.mainAmount}>{formatRp(data?.totalBalance)}</Text>
        </View>

        <View style={styles.cardRow}>
           <StatCard label="Total Rekening" value={data?.totalAccounts || '0'} icon="people" color={C.info} />
           <StatCard label="Produk Aktif" value={data?.products?.length || '0'} icon="cube" color={C.secondary} />
        </View>
        <View style={styles.cardRow}>
           <StatCard label="Total Setoran" value={formatRp(data?.deposits?.amount)} icon="trending-up" color={C.success} />
           <StatCard label="Total Penarikan" value={formatRp(data?.withdrawals?.amount)} icon="trending-down" color={C.warning} />
        </View>

        <Text style={styles.sectionTitle}>Detail Per Produk Simpanan</Text>

        {data?.products?.map((item: any, idx: number) => (
          <View key={idx} style={styles.productCard}>
             <View style={styles.productHeader}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.productCode}</Text></View>
                <Text style={styles.productName}>{item.productName}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Tipe Produk</Text>
                <Text style={styles.value}>{item.productType === 'mandatory' ? 'Wajib' : item.productType === 'principal' ? 'Pokok' : 'Sukarela'}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Jml Rekening</Text>
                <Text style={styles.value}>{item.accountCount}</Text>
             </View>

             <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                <Text style={styles.labelBold}>Total Saldo</Text>
                <Text style={styles.valueBold}>{formatRp(item.totalBalance)}</Text>
             </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={[styles.stat, { borderLeftColor: color }]}>
       <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
         <Text style={styles.statLabel}>{label}</Text>
         <Ionicons name={icon} size={16} color={C.mutedForeground} />
       </View>
       <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 24, marginBottom: 12 },
  statGrid: {
    backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardHeaderTitle: { fontSize: 13, color: C.mutedForeground, fontWeight: '600' },
  mainAmount: { fontSize: 28, fontWeight: 'bold', color: C.primary },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
  productCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  badge: { backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: C.primary, fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  productName: { fontSize: 15, fontWeight: 'bold', color: C.primary, flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, color: C.mutedForeground },
  value: { fontSize: 13, color: C.foreground, fontWeight: '500' },
  labelBold: { fontSize: 13, color: C.primary, fontWeight: '600' },
  valueBold: { fontSize: 14, color: C.success, fontWeight: 'bold' },
});
