import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, Modal, TextInput, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
  receiptPath?: string;
  notes?: string;
}

interface ExpenseSummary {
  total: number;
  count: number;
}

const CATEGORIES = [
  'Bahan & Perlengkapan',
  'Listrik & Air',
  'Gaji Karyawan',
  'Pemeliharaan',
  'Transportasi',
  'Lainnya',
];

const PERIOD_FILTERS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric'
});

export default function PengeluaranOperasionalScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;

  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');
  const [unitSlug, setUnitSlug] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formNotes, setFormNotes] = useState('');

  // Unit type → slug mapping
  const unitTypeToSlug: Record<string, string> = {
    cuci_mobil: 'cuci-mobil',
    barbershop: 'barbershop',
    fitness: 'fitness',
    fotocopy: 'fotocopy',
    playstation: 'playstation',
    toko: 'toko',
    resto_cafe: 'resto-cafe',
    laundry: 'laundry',
  };

  useEffect(() => {
    SecureStore.getItemAsync('userData').then((u) => {
      if (u) {
        try {
          const user = JSON.parse(u);
          if (user.unitType) {
            setUnitSlug(unitTypeToSlug[user.unitType] || user.unitType);
          }
        } catch (e) {}
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!unitSlug) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/unit/${unitSlug}/operational-expense?period=${period}`);
      const data = res.data.data || [];
      setItems(data);
      setSummary({
        total: data.reduce((s: number, e: Expense) => s + e.amount, 0),
        count: data.length,
      });
    } catch (err: any) {
      console.log('Expense fetch error:', err);
      Alert.alert('Error', err.message || 'Gagal memuat data pengeluaran');
    } finally {
      setLoading(false);
    }
  }, [unitSlug, period]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleSubmit = async () => {
    if (!formDesc || !formAmount) {
      Alert.alert('Peringatan', 'Deskripsi dan nominal wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/unit/${unitSlug}/operational-expense`, {
        description: formDesc,
        amount: Number(formAmount),
        category: formCategory,
        notes: formNotes,
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      setFormDesc('');
      setFormAmount('');
      setFormNotes('');
      await loadData();
      Alert.alert('Berhasil', 'Pengeluaran berhasil dicatat');
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setSubmitting(false);
    }
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
            <Text style={styles.headerTitle}>Pengeluaran Operasional</Text>
            <Text style={styles.headerSub}>{summary.count} transaksi</Text>
          </View>
        </View>

        {/* Total card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Pengeluaran</Text>
          <Text style={styles.totalAmount}>{formatRp(summary.total)}</Text>
        </View>
      </View>

      {/* Period filter */}
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

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>Belum ada pengeluaran di periode ini</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.cardAmount}>{formatRp(item.amount)}</Text>
              </View>
              <Text style={styles.cardDate}>{formatDate(item.date || item.createdAt)}</Text>
              {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
            </View>
          )}
        />
      )}

      {/* FAB Tambah */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)}>
        <Ionicons name="add" size={28} color={C.primary} />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.foreground }}>Catat Pengeluaran</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Deskripsi *</Text>
            <TextInput
              style={styles.formInput}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="Contoh: Beli sabun cuci"
            />

            <Text style={styles.formLabel}>Nominal (Rp) *</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={formAmount}
              onChangeText={setFormAmount}
              placeholder="0"
            />

            <Text style={styles.formLabel}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, formCategory === c && styles.catChipActive]}
                  onPress={() => setFormCategory(c)}
                >
                  <Text style={[styles.catChipText, formCategory === c && styles.catChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.formLabel}>Catatan (Opsional)</Text>
            <TextInput
              style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
              multiline
              value={formNotes}
              onChangeText={setFormNotes}
              placeholder="Catatan tambahan..."
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  totalCard: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, marginTop: 14,
  },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  totalAmount: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: C.primaryLight + '20', borderColor: C.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  filterChipTextActive: { color: C.primary },
  card: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDesc: { fontSize: 14, fontWeight: '600', color: C.foreground },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  cardAmount: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
  cardDate: { fontSize: 11, color: C.mutedForeground, marginTop: 8 },
  cardNotes: { fontSize: 11, color: C.mutedForeground, marginTop: 4, fontStyle: 'italic' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 12 },
  formInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 12, fontSize: 14,
  },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.muted,
  },
  catChipActive: { backgroundColor: C.primary },
  catChipText: { fontSize: 12, color: C.mutedForeground, fontWeight: '600' },
  catChipTextActive: { color: '#FFF' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  submitText: { color: C.primary, fontWeight: 'bold', fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
