import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { StorageManager } from '../../lib/storage';
import { log } from '../../utils/log';

export default function GajiPeriodeScreen({ route, navigation }: any) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Import + Delete are operator-only (parity with the API gate).
  const canManage = useMemo(() => {
    const ud = StorageManager.getFastString('userData');
    if (!ud) return false;
    try { return JSON.parse(ud).role === 'operator'; } catch { return false; }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/payroll');
      setPeriods(res.data.data || []);
    } catch (err) {
      log.error('Failed to load payroll periods:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleDelete = (period: any) => {
    Alert.alert(
      "Hapus Periode Gaji",
      `Hapus "${period.name || 'periode ini'}"? Semua slip gaji akan terhapus. sisaGaji anggota TIDAK direset.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post('/api/mobile/payroll/delete', { periodId: period.id });
              Alert.alert("Berhasil", "Periode gaji dihapus.");
              loadData();
            } catch (err: any) {
              log.error('payroll delete failed:', err);
              const msg = err?.response?.data?.message || err?.message || "Gagal menghapus.";
              Alert.alert("Gagal", msg);
            }
          },
        },
      ],
    );
  };

  const statusColor = (s: string) => s === 'published' ? '#16A34A' : '#D97706';
  const statusLabel = (s: string) => s === 'published' ? 'Published' : 'Draft';

  const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GajiSlip', { periodId: item.id, periodName: item.name || `${monthNames[item.month]} ${item.year}` })}
    >
      <View style={styles.cardRow}>
        <View style={[styles.monthBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: statusColor(item.status) }}>
            {item.month || '?'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.periodName}>{item.name || `${monthNames[item.month] || ''} ${item.year}`}</Text>
          <Text style={styles.periodSub}>{item.slipCount} slip gaji</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor(item.status) }}>
              {statusLabel(item.status)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {canManage && (
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.headerTitle}>Gaji & Payroll</Text>
          <Text style={styles.headerSub}>{periods.length} periode</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            onPress={() => navigation.navigate('PayrollImport')}
            style={styles.importBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="cloud-upload" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={periods}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>Belum ada data payroll</Text>
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
  importBtn: { padding: 8 },
  deleteBtn: { padding: 6, marginRight: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  monthBadge: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  periodName: { fontSize: 16, fontWeight: '700', color: C.foreground },
  periodSub: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
