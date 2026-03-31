import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

const TYPES = [
  { label: 'Setoran Simpanan', value: 'simpanan' },
  { label: 'Pencairan Pinjaman', value: 'pinjaman' },
  { label: 'Pembayaran Angsuran', value: 'angsuran' },
  { label: 'Transaksi Unit', value: 'unit_transaction' },
];

const PAYMENTS = [
  { label: 'Tunai', value: 'cash' },
  { label: 'Transfer Bank', value: 'bank_transfer' },
  { label: 'Potong Gaji', value: 'potong_gaji' },
  { label: 'Debet Simpanan', value: 'debet_simpanan' },
  { label: 'QRIS', value: 'qris' },
];

export default function KwitansiFormScreen({ route, navigation }: any) {
  const { receiptId } = route.params || {};
  const isEditing = !!receiptId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [memberId, setMemberId] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberNameDisplay, setMemberNameDisplay] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const [type, setType] = useState('simpanan');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isEditing) {
      loadDraft(receiptId);
    }
  }, [receiptId, isEditing]);

  const loadDraft = async (id: number) => {
    try {
      const res = await api.get(`/api/receipts/${id}`);
      const data = res.data.data;
      if (data) {
        setMemberId(data.memberId?.toString() || '');
        setMemberNameDisplay(data.member?.name || '');
        setType(data.type);
        setAmount(data.amount?.toString() || '');
        setDescription(data.description || '');
        setReceivedFrom(data.receivedFrom || '');
        setPaymentMethod(data.paymentMethod || 'cash');
        setNotes(data.notes || '');
      }
    } catch (err: any) {
      Alert.alert('Gagal', 'Gagal memuat draft kwitansi');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSearchMember = async () => {
    if (!memberQuery) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/api/members?search=${memberQuery}&limit=1`);
      const members = res.data.data;
      if (members && members.length > 0) {
        const m = members[0];
        setMemberId(m.id.toString());
        setMemberNameDisplay(`${m.name} (${m.memberNo || m.nrp})`);
        setMemberQuery('');
      } else {
        Alert.alert('Info', 'Anggota tidak ditemukan');
        setMemberId('');
        setMemberNameDisplay('');
      }
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan pencarian anggota');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSave = async () => {
    if (!memberId || !amount || !description || !receivedFrom) {
      Alert.alert('Peringatan', 'Lengkapi semua data yang wajib (Anggota, Jumlah, Keterangan, Sudah Terima Dari)');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        memberId: parseInt(memberId),
        type,
        amount: parseFloat(amount),
        description,
        receivedFrom,
        paymentMethod,
        notes,
        receiptDate: new Date().toISOString(), // Use current date for mobile
      };

      if (isEditing) {
        await api.put(`/api/receipts/${receiptId}`, payload);
        Alert.alert('Berhasil', 'Kwitansi berhasil diperbarui');
      } else {
        await api.post('/api/receipts', payload);
        Alert.alert('Berhasil', 'Draft Kwitansi berhasil dibuat');
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
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
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Kwitansi' : 'Buat Kwitansi'}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          
          {/* Pencarian Anggota (Aktif jika buatan baru atau mau ganti) */}
          <Text style={styles.label}>Cari Anggota *</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Nama atau NRP..."
              value={memberQuery}
              onChangeText={setMemberQuery}
              onSubmitEditing={handleSearchMember}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearchMember} disabled={searchLoading}>
              {searchLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
          {memberNameDisplay ? (
            <View style={styles.memberSelectedBox}>
              <Ionicons name="person-circle" size={24} color={C.primary} />
              <Text style={styles.memberSelectedText}>{memberNameDisplay}</Text>
              <TouchableOpacity onPress={() => { setMemberId(''); setMemberNameDisplay(''); }}>
                <Ionicons name="close-circle" size={20} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Untuk Keperluan / Jenis */}
          <Text style={styles.label}>Jenis Transaksi *</Text>
          <View style={styles.btnGroup}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeBtn, type === t.value && styles.typeBtnActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.typeBtnText, type === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Keterangan *</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Contoh: Pencairan Pinjaman Reguler tahap 1"
          />

          <Text style={styles.label}>Uang Sejumlah (Rp) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="Contoh: 5000000"
          />

          <Text style={styles.label}>Sudah Terima Dari *</Text>
          <TextInput
            style={styles.input}
            value={receivedFrom}
            onChangeText={setReceivedFrom}
            placeholder="Contoh: Bripka Jhon Doe"
          />

          <Text style={styles.label}>Metode Pembayaran *</Text>
          <View style={styles.btnGroup}>
            {PAYMENTS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.typeBtn, paymentMethod === p.value && styles.typeBtnActive]}
                onPress={() => setPaymentMethod(p.value)}
              >
                <Text style={[styles.typeBtnText, paymentMethod === p.value && styles.typeBtnTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Catatan (Opsional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Catatan tambahan di kwitansi"
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={C.primary} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={C.primary} />
              <Text style={styles.submitBtnText}>Simpan Draft Kwitansi</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centerContainer: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.foreground, marginBottom: 4,
  },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBtn: {
    backgroundColor: C.primary, width: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  memberSelectedBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.successBg,
    padding: 12, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: C.success + '40',
  },
  memberSelectedText: { flex: 1, color: C.success, fontWeight: '600', fontSize: 14 },
  btnGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    backgroundColor: C.muted, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: C.accentBg, borderColor: C.accent },
  typeBtnText: { color: C.mutedForeground, fontSize: 13, fontWeight: '500' },
  typeBtnTextActive: { color: C.accent, fontWeight: 'bold' },
  footer: {
    padding: 20, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
  },
  submitBtn: {
    backgroundColor: C.accent, height: 50, borderRadius: 25,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
