import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Alert, ActivityIndicator, TextInput, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../../lib/api';
import { StorageManager } from '../../lib/storage';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const formatDate = (d: string) => new Date(d).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

interface Shift {
  id: number;
  shiftName: string;
  startedAt: string;
  endedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  totalSalesCash: number;
  totalSalesQris: number;
  totalSalesCredit: number;
  totalTransactions: number;
  cashDifference: number | null;
  status: string;
  salesCount: number;
  userName: string;
  unitType: string;
}

const SHIFT_OPTIONS = ['Pagi', 'Siang', 'Malam'];

export default function ShiftScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);

  // Open shift form
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [selectedShiftName, setSelectedShiftName] = useState('Pagi');
  const [openingCash, setOpeningCash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Close shift form
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [kasirUnitType, setKasirUnitType] = useState('toko');

  useEffect(() => {
    const u = StorageManager.getFastString('userData');
    if (u) {
      try {
        const user = JSON.parse(u);
        if (user.unitType) setKasirUnitType(user.unitType);
      } catch (e) {}
    }
  }, []);

  const fetchShifts = useCallback(async () => {
    try {
      const [openRes, recentRes] = await Promise.all([
        api.get('/api/mobile/toko/shifts?status=open&limit=1'),
        api.get('/api/mobile/toko/shifts?limit=10'),
      ]);
      const openData = openRes.data?.data || [];
      setOpenShift(openData.length > 0 ? openData[0] : null);
      setRecentShifts(recentRes.data?.data || []);
    } catch (err: any) {
      console.error('Fetch shifts error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchShifts(); }, [fetchShifts]));

  const handleOpenShift = async () => {
    const numCash = parseInt(openingCash.replace(/\D/g, ''), 10) || 0;
    setSubmitting(true);
    try {
      const res = await api.post('/api/mobile/toko/shifts', {
        shiftName: selectedShiftName,
        openingCash: numCash,
        unitType: kasirUnitType,
      });
      Alert.alert('Sukses', res.data?.message || 'Shift berhasil dibuka', [
        { text: 'Masuk POS', onPress: () => navigation.navigate('KasirFull') }
      ]);
      setShowOpenForm(false);
      setOpeningCash('');
      fetchShifts();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal membuka shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!openShift) return;
    const numCash = parseInt(closingCash.replace(/\D/g, ''), 10);
    if (isNaN(numCash) || numCash < 0) {
      return Alert.alert('Error', 'Masukkan jumlah uang fisik yang valid');
    }
    setSubmitting(true);
    try {
      const res = await api.put(`/api/mobile/toko/shifts/${openShift.id}`, {
        closingCash: numCash,
        notes: closingNotes || undefined,
      });
      Alert.alert('Shift Ditutup', res.data?.message || 'Shift berhasil ditutup');
      setShowCloseForm(false);
      setClosingCash('');
      setClosingNotes('');
      fetchShifts();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal menutup shift');
    } finally {
      setSubmitting(false);
    }
  };

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
        {navigation.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shift Kasir</Text>
          <Text style={{ color: C.accentLight, fontSize: 12 }}>Unit {kasirUnitType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchShifts(); }}>
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchShifts} colors={[C.accent]} />}
      >
        {/* ── Status Shift Saat Ini ─────────────────────────── */}
        {openShift ? (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: C.success }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ backgroundColor: C.successBg, padding: 8, borderRadius: 10 }}>
                <Ionicons name="checkmark-circle" size={24} color={C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.foreground }}>Shift {openShift.shiftName} — AKTIF</Text>
                <Text style={{ fontSize: 12, color: C.mutedForeground }}>Dibuka {formatDate(openShift.startedAt)}</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Kas Awal</Text>
                <Text style={styles.statValue}>{formatRp(openShift.openingCash)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Transaksi</Text>
                <Text style={styles.statValue}>{openShift.salesCount}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.info, flex: 1 }]}
                onPress={() => navigation.navigate('KasirFull')}
              >
                <Ionicons name="cart" size={18} color="#FFF" />
                <Text style={styles.btnText}>Masuk POS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.destructive, flex: 1 }]}
                onPress={() => setShowCloseForm(true)}
              >
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={styles.btnText}>Tutup Shift</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.accent, marginTop: 8 }]}
              onPress={() => navigation.navigate('RiwayatKasir')}
            >
              <Ionicons name="receipt" size={18} color={C.primary} />
              <Text style={[styles.btnText, { color: C.primary }]}>📋 Riwayat Transaksi & Void</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: C.warning }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ backgroundColor: C.warningBg, padding: 8, borderRadius: 10 }}>
                <Ionicons name="alert-circle" size={24} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.foreground }}>Belum Ada Shift Aktif</Text>
                <Text style={{ fontSize: 12, color: C.mutedForeground }}>Buka shift terlebih dahulu untuk memulai POS</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.success }]}
              onPress={() => setShowOpenForm(true)}
            >
              <Ionicons name="play-circle" size={20} color="#FFF" />
              <Text style={styles.btnText}>Buka Shift Baru</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Form Buka Shift ────────────────────────────── */}
        {showOpenForm && !openShift && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.foreground, marginBottom: 16 }}>Buka Shift Baru</Text>

            <Text style={styles.label}>Pilih Shift</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {SHIFT_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, selectedShiftName === s && styles.chipActive]}
                  onPress={() => setSelectedShiftName(s)}
                >
                  <Text style={[styles.chipText, selectedShiftName === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Kas Awal (Rp)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={openingCash}
              onChangeText={setOpeningCash}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: C.muted, flex: 1 }]} onPress={() => setShowOpenForm(false)}>
                <Text style={[styles.btnText, { color: C.foreground }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.success, flex: 1 }, submitting && { opacity: 0.6 }]}
                onPress={handleOpenShift}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="play" size={18} color="#FFF" />}
                <Text style={styles.btnText}>Buka Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Form Tutup Shift ───────────────────────────── */}
        {showCloseForm && openShift && (
          <View style={[styles.card, { marginTop: 16, borderWidth: 2, borderColor: C.destructive }]}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.destructive, marginBottom: 12 }}>Tutup Shift {openShift.shiftName}</Text>

            <View style={{ backgroundColor: C.infoBg, padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: C.info, marginBottom: 4 }}>📋 Ringkasan Shift</Text>
              <Text style={{ fontSize: 13, color: C.foreground }}>Kas Awal: {formatRp(openShift.openingCash)}</Text>
              <Text style={{ fontSize: 13, color: C.foreground }}>Jumlah Transaksi: {openShift.salesCount}</Text>
            </View>

            <Text style={styles.label}>Jumlah Uang Fisik di Kasir (Rp) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Hitung dan masukkan total uang fisik"
              keyboardType="numeric"
              value={closingCash}
              onChangeText={setClosingCash}
            />

            <Text style={styles.label}>Catatan (Opsional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Catatan akhir shift..."
              value={closingNotes}
              onChangeText={setClosingNotes}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: C.muted, flex: 1 }]} onPress={() => setShowCloseForm(false)}>
                <Text style={[styles.btnText, { color: C.foreground }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.destructive, flex: 1 }, submitting && { opacity: 0.6 }]}
                onPress={() => {
                  Alert.alert('Konfirmasi Tutup Shift', 'Pastikan uang sudah dihitung. Setelah ditutup, shift tidak bisa dibuka kembali.', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Ya, Tutup', style: 'destructive', onPress: handleCloseShift },
                  ]);
                }}
                disabled={submitting || !closingCash}
              >
                {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="lock-closed" size={18} color="#FFF" />}
                <Text style={styles.btnText}>Tutup Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Riwayat Shift ──────────────────────────────── */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.foreground, marginTop: 24, marginBottom: 12 }}>
          Riwayat Shift Terakhir
        </Text>
        {recentShifts.length === 0 ? (
          <Text style={{ color: C.mutedForeground, textAlign: 'center', paddingVertical: 20 }}>Belum ada riwayat shift</Text>
        ) : (
          recentShifts.map((s) => (
            <View key={s.id} style={[styles.historyCard, s.status === 'open' && { borderColor: C.success }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold', color: C.foreground }}>Shift {s.shiftName}</Text>
                <View style={[styles.badge, s.status === 'open' ? { backgroundColor: C.successBg } : { backgroundColor: C.muted }]}>
                  <Text style={[styles.badgeText, s.status === 'open' ? { color: C.success } : { color: C.mutedForeground }]}>
                    {s.status === 'open' ? 'AKTIF' : 'SELESAI'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: C.mutedForeground }}>{s.userName} • {formatDate(s.startedAt)}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: C.foreground }}>Transaksi: {s.salesCount}</Text>
                <Text style={{ fontSize: 12, color: C.foreground }}>Kas Awal: {formatRp(s.openingCash)}</Text>
                {s.closingCash !== null && (
                  <Text style={{ fontSize: 12, color: C.foreground }}>Kas Akhir: {formatRp(s.closingCash)}</Text>
                )}
              </View>
              {s.cashDifference !== null && (
                <Text style={{ fontSize: 12, marginTop: 4, fontWeight: 'bold', color: s.cashDifference === 0 ? C.success : C.destructive }}>
                  Selisih: {s.cashDifference === 0 ? 'Pas ✅' : `${formatRp(Math.abs(s.cashDifference))} ${s.cashDifference > 0 ? '(lebih)' : '(kurang)'}`}
                </Text>
              )}
            </View>
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
    flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: C.mutedForeground, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: C.foreground,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontWeight: '600', color: C.mutedForeground },
  chipTextActive: { color: C.primary },
  statRow: { flexDirection: 'row', gap: 12 },
  statItem: { flex: 1, backgroundColor: C.background, padding: 12, borderRadius: 10 },
  statLabel: { fontSize: 11, color: C.mutedForeground },
  statValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground, marginTop: 2 },
  historyCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
});
