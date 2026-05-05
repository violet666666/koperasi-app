import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function BatchManagementScreen({ navigation }: any) {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewFilter, setViewFilter] = useState<string>('active');

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/api/mobile/batches?view=${viewFilter}`);
      setBatches(res.data.data || []);
    } catch (err) {
      console.log('Failed to load batches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [viewFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const expiryColor = (date: string | null) => {
    if (!date) return C.mutedForeground;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (days <= 0) return '#DC2626';
    if (days <= 90) return '#D97706';
    return '#16A34A';
  };

  const expiryLabel = (date: string | null) => {
    if (!date) return 'Tanpa expiry';
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'EXPIRED';
    if (days <= 90) return `${days} hari lagi`;
    return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filters = [
    { key: 'active', label: 'Aktif' },
    { key: 'expiring_soon', label: 'Hampir Expired' },
    { key: 'expired', label: 'Expired' },
    { key: 'all', label: 'Semua' },
  ];

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
          <Text style={styles.headerTitle}>Manajemen Batch</Text>
          <Text style={styles.headerSub}>{batches.length} batch</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, viewFilter === f.key && styles.filterChipActive]}
            onPress={() => { setViewFilter(f.key); setLoading(true); }}
          >
            <Text style={[styles.filterText, viewFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={batches}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.product?.name || 'Produk Dihapus'}</Text>
                <Text style={styles.batchNo}>{item.batchNo}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (item.isActive === false ? '#FEE2E2' : '#DCFCE7') }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: (item.isActive === false ? '#DC2626' : '#16A34A') }}>
                  {item.isActive === false ? 'EXPIRED' : 'AKTIF'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              <View>
                <Text style={styles.detailLabel}>Qty</Text>
                <Text style={styles.detailValue}>{item.quantity || 0}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>HPP</Text>
                <Text style={styles.detailValue}>{formatRp(Number(item.purchasePrice) || 0)}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Expiry</Text>
                <Text style={[styles.detailValue, { color: expiryColor(item.expiryDate) }]}>
                  {expiryLabel(item.expiryDate)}
                </Text>
              </View>
            </View>

            {item.supplierName && (
              <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 6 }}>
                Supplier: {item.supplierName}
              </Text>
            )}
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada batch</Text>
          </View>
        }
      />
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
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: C.mutedForeground },
  filterTextActive: { color: '#FFF' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  productName: { fontSize: 14, fontWeight: '700', color: C.foreground },
  batchNo: { fontSize: 11, color: C.mutedForeground, marginTop: 2, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailLabel: { fontSize: 10, color: C.mutedForeground, fontWeight: '600' },
  detailValue: { fontSize: 13, color: C.foreground, fontWeight: '500', marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
