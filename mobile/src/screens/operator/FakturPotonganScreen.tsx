import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const BULAN_LABEL = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

type PotonganLine = { jenis: string; ptKe: string; jumlah: number };
type FakturItem = {
  seq: number;
  noRes: string;
  notaBuku: string;
  nama: string;
  nrp: string;
  pangkat: string;
  kesatuan: string;
  potongan: PotonganLine[];
  totalPotongan: number;
};

type ApiResponse = {
  data: {
    fakturList: FakturItem[];
    month: number;
    year: number;
    periodLabel: string;
    totalAnggota: number;
    totalNominal: number;
    pagination?: { page: number; perPage: number; totalItems: number; totalPages: number };
  };
};

export default function FakturPotonganScreen({ navigation }: any) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [fakturs, setFakturs] = useState<FakturItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({ anggota: 0, nominal: 0 });
  const [detailItem, setDetailItem] = useState<FakturItem | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse>('/api/mobile/reports/faktur-potongan', {
        params: { month: String(month), year: String(year) },
      });
      const d = res.data.data;
      setFakturs(d.fakturList || []);
      setTotals({ anggota: d.totalAnggota || 0, nominal: d.totalNominal || 0 });
    } catch (err) {
      log.error('Failed to load faktur potongan:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const renderItem = ({ item }: { item: FakturItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setDetailItem(item)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{item.nama}</Text>
          <Text style={styles.subLine}>{item.nrp} {item.pangkat ? '• ' + item.pangkat : ''}</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{formatRp(item.totalPotongan)}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>{item.noRes}</Text>
        <Text style={styles.metaText}>{item.potongan.length} item</Text>
      </View>
    </TouchableOpacity>
  );

  const MONTHS = BULAN_LABEL.slice(1);
  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Faktur Potongan</Text>
            <Text style={styles.headerSub}>
              {MONTHS[month - 1]} {year} — {totals.anggota} anggota
            </Text>
          </View>
        </View>

        {/* Month/Year Pickers */}
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMonthPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.pickerText}>{MONTHS[month - 1]}</Text>
            <Ionicons name="chevron-down" size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowYearPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.pickerText}>{year}</Text>
            <Ionicons name="chevron-down" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: C.info }]}>
          <Text style={styles.summaryLabel}>Total Anggota</Text>
          <Text style={styles.summaryValue}>{totals.anggota}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: C.destructive }]}>
          <Text style={styles.summaryLabel}>Total Nominal</Text>
          <Text style={styles.summaryValue}>{formatRp(totals.nominal)}</Text>
        </View>
      </View>

      <FlatList
        data={fakturs}
        keyExtractor={(item) => String(item.seq)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
              Tidak ada faktur potongan periode ini
            </Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!detailItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {detailItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Rincian Faktur</Text>
                  <TouchableOpacity onPress={() => setDetailItem(null)}>
                    <Ionicons name="close-circle" size={28} color={C.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalMeta}>
                  <Text style={styles.modalMetaLine}>{detailItem.noRes}</Text>
                  <Text style={styles.modalMetaLine}>{detailItem.notaBuku}</Text>
                  <Text style={styles.modalMetaLine}>{detailItem.nama} — {detailItem.nrp}</Text>
                  <Text style={styles.modalMetaLine}>{detailItem.pangkat} {detailItem.kesatuan !== '-' ? '• ' + detailItem.kesatuan : ''}</Text>
                </View>
                <View style={styles.itemsHeader}>
                  <Text style={styles.itemsHeaderText}>Rincian Potongan</Text>
                </View>
                {detailItem.potongan.map((p, i) => (
                  <View key={i} style={styles.potonganRow}>
                    <View>
                      <Text style={styles.potonganJenis}>{p.jenis}</Text>
                      {p.ptKe ? <Text style={styles.potonganPt}>Ke-{p.ptKe}</Text> : null}
                    </View>
                    <Text style={styles.potonganAmount}>{formatRp(p.jumlah)}</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Potongan</Text>
                  <Text style={styles.totalAmount}>{formatRp(detailItem.totalPotongan)}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Pilih Bulan</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerOption, month === i + 1 && styles.pickerOptionActive]}
                  onPress={() => { setMonth(i + 1); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, month === i + 1 && styles.pickerOptionTextActive]}>
                    {m} {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowYearPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Pilih Tahun</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {YEARS.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerOption, year === y && styles.pickerOptionActive]}
                  onPress={() => { setYear(y); setShowYearPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, year === y && styles.pickerOptionTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  pickerRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  pickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  pickerText: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 0 },
  summaryCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  summaryLabel: { fontSize: 11, color: C.mutedForeground },
  summaryValue: { fontSize: 16, fontWeight: '700', color: C.foreground, marginTop: 2 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  memberName: { fontSize: 16, fontWeight: '700', color: C.foreground },
  subLine: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  totalBadge: { backgroundColor: C.destructive + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  totalBadgeText: { color: C.destructive, fontSize: 13, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaText: { fontSize: 11, color: C.mutedForeground },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
  modalMeta: { backgroundColor: C.background, borderRadius: 12, padding: 12, marginBottom: 16 },
  modalMetaLine: { fontSize: 13, color: C.foreground, lineHeight: 22 },
  itemsHeader: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginBottom: 8 },
  itemsHeaderText: { fontSize: 14, fontWeight: '700', color: C.primary },
  potonganRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  potonganJenis: { fontSize: 15, fontWeight: '600', color: C.foreground },
  potonganPt: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  potonganAmount: { fontSize: 15, fontWeight: '700', color: C.destructive },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, marginTop: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: C.primary },
  totalAmount: { fontSize: 18, fontWeight: '700', color: C.destructive },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerSheet: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '80%', maxWidth: 300 },
  pickerSheetTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 12, textAlign: 'center' },
  pickerOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  pickerOptionActive: { backgroundColor: C.primary + '18' },
  pickerOptionText: { fontSize: 15, color: C.foreground },
  pickerOptionTextActive: { color: C.primary, fontWeight: '700' },
});
