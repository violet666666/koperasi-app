import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function LaporanPinjamanScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/reports/loans');
      setData(res.data.data);
    } catch (err: any) {
      console.log('Failed to load loans report:', err);
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
        <Text style={styles.headerTitle}>📊 Rekap Pinjaman</Text>
        <Text style={styles.headerSubtitle}>Laporan Agregasi Produk Pinjaman</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Ringkasan Total</Text>

        <View style={styles.cardRow}>
           <StatCard label="Total Pinjaman" value={data?.totalLoans || '0'} icon="albums" color={C.primary} />
           <StatCard 
             label="Kolektibilitas" 
             value={`${data?.avgCollectibility || 0}%`} 
             icon="shield-checkmark" 
             color={data?.avgCollectibility >= 90 ? C.success : C.warning} 
           />
        </View>

        <View style={styles.statGrid}>
           <BalanceRow label="Total Dicairkan" value={data?.totalDisbursed} color={C.info} />
           <BalanceRow label="Sudah Dibayar" value={data?.totalPaid} color={C.success} />
           <View style={styles.divider} />
           <BalanceRow label="Total Outstanding" value={data?.totalOutstanding} color={C.destructive} bold />
        </View>

        <Text style={styles.sectionTitle}>Detail Per Produk Pinjaman</Text>

        {data?.products?.map((item: any, idx: number) => (
          <View key={idx} style={styles.productCard}>
             <View style={styles.productHeader}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.productCode}</Text></View>
                <Text style={styles.productName}>{item.productName}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Suku Bunga</Text>
                <Text style={styles.value}>{item.interestRate}% / bln</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Dicairkan</Text>
                <Text style={styles.value}>{formatRp(item.totalDisbursed)}</Text>
             </View>

             <View style={styles.rowBetween}>
                <Text style={styles.label}>Outstanding</Text>
                <Text style={[styles.value, { color: C.destructive }]}>{formatRp(item.totalOutstanding)}</Text>
             </View>

             <View style={{ marginTop: 12, marginBottom: 4 }}>
                <View style={styles.rowBetween}>
                   <Text style={{ fontSize: 11, color: C.mutedForeground }}>Kolektibilitas Rasio</Text>
                   <Text style={{ fontSize: 11, fontWeight: 'bold', color: item.collectibilityRatio >= 90 ? C.success : C.warning }}>
                     {item.collectibilityRatio}%
                   </Text>
                </View>
                <View style={styles.progressBarBg}>
                   <View style={[styles.progressBarFill, { 
                       width: `${Math.min(item.collectibilityRatio || 0, 100)}%`,
                       backgroundColor: item.collectibilityRatio >= 90 ? C.success : item.collectibilityRatio >= 75 ? C.warning : C.destructive
                   }]} />
                </View>
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

function BalanceRow({ label, value, color, bold }: any) {
  return (
    <View style={styles.balanceRow}>
       <Text style={[styles.balanceLabel, bold && { fontWeight: 'bold', color: C.primary }]}>{label}</Text>
       <Text style={[styles.balanceValue, { color: color || C.foreground }, bold && { fontSize: 16 }]}>{formatRp(value)}</Text>
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
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  balanceLabel: { fontSize: 14, color: C.mutedForeground },
  balanceValue: { fontSize: 15, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
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
  progressBarBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
});
