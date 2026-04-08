import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

// Types
interface ReportData {
  pendapatanKotor: number;
  bagianKaryawan: number;
  bagianKoperasi: number;
  totalPengeluaran: number;
  labaBersihKoperasi: number;
  period: string;
  unitType: string;
}

const PERIOD_FILTERS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function LaporanCuciMobilScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/reports/unit?unitType=cuci_mobil&period=${period}`);
      setData(res.data.data);
    } catch (err: any) {
      console.log('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {canGoBack && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Laporan Cuci Mobil</Text>
            <Text style={styles.headerSub}>Bagi Hasil Koperasi & Karyawan</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {PERIOD_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, period === f.key && styles.filterChipActive]}
            onPress={() => setPeriod(f.key)}
          >
            <Text style={[styles.filterChipText, period === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={C.primary} />
            <Text style={{ marginTop: 10, color: C.mutedForeground }}>Memuat laporan...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconContainer}><Ionicons name="cash" size={20} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Pendapatan Kotor</Text>
                  <Text style={styles.valuePrimary}>{formatRp(data.pendapatanKotor)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Alokasi Bagi Hasil (50:50)</Text>
            
            <View style={styles.card}>
              <View style={[styles.row, { borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2' }]}><Ionicons name="people" size={20} color="#EF4444" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Bagian Karyawan (50%)</Text>
                  <Text style={[styles.value, { color: '#EF4444' }]}>{formatRp(data.bagianKaryawan)}</Text>
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}><Ionicons name="business" size={20} color="#10B981" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Bagian Koperasi (50%)</Text>
                  <Text style={[styles.value, { color: '#10B981' }]}>{formatRp(data.bagianKoperasi)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pengeluaran & Laba Koperasi</Text>

            <View style={[styles.card, { borderColor: C.accent, borderWidth: 1 }]}>
              <View style={[styles.row, { borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FFFBEB' }]}><Ionicons name="receipt" size={20} color="#F59E0B" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Total Pengeluaran Ops.</Text>
                  <Text style={[styles.value, { color: '#F59E0B' }]}>- {formatRp(data.totalPengeluaran)}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.iconContainer, { backgroundColor: C.primaryLight + '20' }]}><Ionicons name="stats-chart" size={20} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { fontWeight: 'bold' }]}>Laba Bersih Koperasi</Text>
                  <Text style={[styles.valuePrimary, { fontSize: 22 }]}>{formatRp(data.labaBersihKoperasi)}</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <Text style={{ textAlign: 'center', color: C.mutedForeground, marginTop: 20 }}>Tidak ada data</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: C.accent, fontSize: 13, marginTop: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
    maxHeight: 35
  },
  filterChipActive: { backgroundColor: C.primaryLight + '20', borderColor: C.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  filterChipTextActive: { color: C.primary },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: C.mutedForeground, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: 'bold' },
  valuePrimary: { fontSize: 18, fontWeight: 'bold', color: C.primary },
});
