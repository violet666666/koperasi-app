import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function GajiSlipScreen({ route, navigation }: any) {
  const { periodId, periodName } = route?.params || {};
  const [slips, setSlips] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/api/mobile/payroll/${periodId}`);
      setPeriod(res.data.data);
      setSlips(res.data.data?.slips || []);
      setFiltered(res.data.data?.slips || []);
    } catch (err) {
      console.log('Failed to load period:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(slips); return; }
    const q = search.toLowerCase();
    setFiltered(slips.filter((s: any) =>
      s.nama?.toLowerCase().includes(q) || s.nrp?.toLowerCase().includes(q)
    ));
  }, [search, slips]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Summary calculations
  const totalGaji = filtered.reduce((s: number, sl: any) => s + (Number(sl.gajiBersih) || 0), 0);
  const totalPotKop = filtered.reduce((s: number, sl: any) => s + (Number(sl.totalPotKoperasi) || 0), 0);
  const totalTerima = filtered.reduce((s: number, sl: any) => s + (Number(sl.terimaBersih) || 0), 0);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.headerTitle}>{periodName || 'Detail Periode'}</Text>
          <Text style={styles.headerSub}>{filtered.length} slip</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.summaryLabel}>Total Gaji</Text>
            <Text style={[styles.summaryValue, { color: '#2563EB' }]}>{formatRp(totalGaji)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.summaryLabel}>Total Pot.</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{formatRp(totalPotKop)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={styles.summaryLabel}>Terima</Text>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{formatRp(totalTerima)}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={C.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau NRP..."
            placeholderTextColor={C.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Slip List */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada slip ditemukan</Text>
          </View>
        ) : (
          filtered.map((slip: any) => (
            <TouchableOpacity
              key={slip.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SlipGajiDetail', { slipId: slip.id, periodId })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slipName}>{slip.nama || '-'}</Text>
                  <Text style={styles.slipNrp}>NRP: {slip.nrp || '-'} {slip.pangkat ? `· ${slip.pangkat}` : ''}</Text>
                </View>
                <Text style={styles.slipAmount}>{formatRp(Number(slip.terimaBersih) || 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View>
                  <Text style={styles.detailLabel}>Gaji</Text>
                  <Text style={styles.detailValue}>{formatRp(Number(slip.gajiBersih) || 0)}</Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Tunkin</Text>
                  <Text style={styles.detailValue}>{formatRp(Number(slip.tunkin) || 0)}</Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Pot. Kop.</Text>
                  <Text style={[styles.detailValue, { color: '#DC2626' }]}>{formatRp(Number(slip.totalPotKoperasi) || 0)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  summaryValue: { fontSize: 12, fontWeight: 'bold' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.foreground },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  slipName: { fontSize: 15, fontWeight: '700', color: C.foreground },
  slipNrp: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  slipAmount: { fontSize: 16, fontWeight: 'bold', color: '#16A34A' },
  detailLabel: { fontSize: 10, color: C.mutedForeground, fontWeight: '600' },
  detailValue: { fontSize: 12, color: C.foreground, fontWeight: '500', marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
