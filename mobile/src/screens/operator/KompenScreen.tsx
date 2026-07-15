import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  TextInput, Modal, FlatList, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Product {
  id: number;
  name: string;
  interestRate: number;
  adminFeeValue: number;
  maxAmount: number;
  maxTenor: number;
  minAmount?: number;
  minTenor?: number;
}
interface Member {
  id: number;
  name: string;
  nrp?: string;
  memberNo?: string;
}
interface EligibleLoan {
  id: number;
  loanNo: string;
  principalAmount: number;
  principalOutstanding: number;
  tenorMonths: number;
  interestRate: number;
  productName: string;
  monthlyInterest: number;
  penaltyFee: number;
  totalKompen: number;
  disbursementDate: string;
}
interface Simulation {
  existingLoan: { loanNo: string; principalOutstanding: number; remainingTenor: number };
  kompen: { principalOutstanding: number; penaltyFee: number; totalKompen: number };
  newLoan: { principalAmount: number; adminFee: number; interestRate: number; tenorMonths: number; monthlyInstallment: number; totalInterest: number; disbursedToMember: number };
  summary: { plafonBaru: number; totalKompen: number; biayaAdmin: number; danaDiterimaAnggota: number };
}

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function KompenScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [memberModal, setMemberModal] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searching, setSearching] = useState(false);
  const [eligibleLoans, setEligibleLoans] = useState<EligibleLoan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('');
  const [simulasi, setSimulasi] = useState<Simulation | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [backdatedDate, setBackdatedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);

  useEffect(() => {
    api.get('/api/mobile/loan-apply').then(res => {
      const prods = res.data.data || [];
      setProducts(prods);
      if (prods.length > 0) setSelectedProduct(prods[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchMember.length > 1) {
      const delay = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await api.get(`/api/mobile/members?search=${searchMember}&limit=10`);
          setMembers(res.data.data || []);
        } finally { setSearching(false); }
      }, 500);
      return () => clearTimeout(delay);
    } else { setMembers([]); }
  }, [searchMember]);

  const selectedLoan = eligibleLoans.find(l => l.id === selectedLoanId);

  const onMemberSelected = async (m: Member) => {
    setSelectedMember(m);
    setMemberModal(false);
    setEligibleLoans([]);
    setSelectedLoanId(null);
    setSimulasi(null);
    setAmount('');
    setTenor('');
    setLoadingEligible(true);
    try {
      const res = await api.get(`/api/loans/kompen/eligible?memberId=${m.id}`);
      setEligibleLoans(res.data.data || []);
      if ((res.data.data || []).length === 0) {
        Toast.show({ type: 'info', text1: 'Tidak Ada Pinjaman Aktif', text2: 'Anggota ini tidak punya pinjaman aktif untuk dikompen.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.response?.data?.message || 'Gagal memuat pinjaman' });
    } finally { setLoadingEligible(false); }
  };

  const runSimulate = async () => {
    if (!selectedMember || !selectedLoanId || !selectedProduct || !amount || !tenor) {
      Toast.show({ type: 'error', text1: 'Lengkapi Data', text2: 'Pilih anggota, pinjaman lama, produk, nominal & tenor.' });
      return;
    }
    setSimLoading(true);
    setSimulasi(null);
    try {
      const res = await api.get('/api/loans/kompen/simulate', {
        params: {
          memberId: selectedMember.id,
          existingLoanId: selectedLoanId,
          newAmount: parseFloat(amount),
          newProductId: selectedProduct.id,
          newTenor: parseInt(tenor),
        },
      });
      setSimulasi(res.data.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal simulasi';
      Toast.show({ type: 'error', text1: 'Simulasi Gagal', text2: msg });
    } finally { setSimLoading(false); }
  };

  const onSubmit = async () => {
    if (!selectedMember || !selectedLoanId || !selectedProduct || !amount || !tenor) return;
    if (!simulasi) {
      Toast.show({ type: 'error', text1: 'Simulasi Dulu', text2: 'Jalankan simulasi sebelum proses kompen.' });
      return;
    }
    Alert.alert(
      'Konfirmasi Kompen',
      `Kompen pinjaman ${selectedLoan?.loanNo}?\n\nDana ke anggota: ${formatRp(simulasi.summary.danaDiterimaAnggota)}`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Proses Kompen', style: 'destructive', onPress: doDisburse },
      ],
    );
  };

  const doDisburse = async () => {
    haptics.impactAsync(haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);
    try {
      const res = await api.post('/api/mobile/loans-operator/kompen-disburse', {
        memberId: selectedMember!.id,
        existingLoanId: selectedLoanId,
        productId: selectedProduct!.id,
        amount: parseFloat(amount),
        tenorMonths: parseInt(tenor),
        backdatedDate: backdatedDate.toISOString(),
      });
      Toast.show({ type: 'success', text1: 'Kompen Berhasil!', text2: res.data.message });
      navigation.goBack();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.response?.data?.message || err.message });
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />
      <View style={[styles.header, { backgroundColor: '#7C3AED' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Ionicons name="swap-horizontal" size={22} color="#FFF" style={{ marginRight: 4 }} />
        <Text style={styles.headerTitle}>Kompen / Rollover</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Step 1: Pilih Anggota */}
          <Text style={styles.label}>1. Pilih Anggota</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setMemberModal(true)}>
            <Text style={{ color: selectedMember ? C.foreground : C.mutedForeground, flex: 1 }}>
              {selectedMember ? `${selectedMember.name} (${selectedMember.nrp || selectedMember.memberNo})` : 'Ketuk untuk cari anggota...'}
            </Text>
            <Ionicons name="search" size={20} color={C.mutedForeground} />
          </TouchableOpacity>

          {loadingEligible && <ActivityIndicator style={{ marginTop: 12 }} color="#7C3AED" />}

          {/* Step 2: Pilih Pinjaman yang Dikompen */}
          {eligibleLoans.length > 0 && (
            <>
              <Text style={styles.label}>2. Pinjaman yang Akan Dilunasi</Text>
              {eligibleLoans.map(loan => (
                <TouchableOpacity
                  key={loan.id}
                  style={[styles.loanCard, selectedLoanId === loan.id && styles.loanCardActive]}
                  onPress={() => { setSelectedLoanId(loan.id); setSimulasi(null); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', color: C.foreground }}>{loan.loanNo}</Text>
                    {selectedLoanId === loan.id && <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />}
                  </View>
                  <Text style={{ color: C.mutedForeground, fontSize: 12, marginTop: 2 }}>{loan.productName}</Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <View>
                      <Text style={{ color: C.mutedForeground, fontSize: 11 }}>Sisa Pokok</Text>
                      <Text style={{ fontWeight: '600', color: C.foreground }}>{formatRp(loan.principalOutstanding)}</Text>
                    </View>
                    <View>
                      <Text style={{ color: C.mutedForeground, fontSize: 11 }}>Tenor</Text>
                      <Text style={{ fontWeight: '600', color: C.foreground }}>{loan.tenorMonths} bln</Text>
                    </View>
                    <View>
                      <Text style={{ color: C.mutedForeground, fontSize: 11 }}>Penalti</Text>
                      <Text style={{ fontWeight: '600', color: '#D97706' }}>{formatRp(loan.penaltyFee)}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                      Total Kompen: {formatRp(loan.totalKompen)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Step 3: Produk & Nominal Baru */}
          {selectedLoanId && (
            <>
              <Text style={styles.label}>3. Produk Pinjaman Baru</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {products.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, selectedProduct?.id === p.id && styles.chipActive]}
                    onPress={() => { setSelectedProduct(p); setSimulasi(null); }}
                  >
                    <Text style={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Plafon Baru (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={t => { setAmount(t); setSimulasi(null); }}
                    placeholder="Contoh: 30000000"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tenor (Bulan)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tenor}
                    onChangeText={t => { setTenor(t); setSimulasi(null); }}
                    placeholder="Maks: 60"
                  />
                </View>
              </View>

              <Text style={styles.label}>Tanggal Akad (Mundur)</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text>{backdatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={backdatedDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => { setShowDatePicker(Platform.OS === 'ios'); if (date) setBackdatedDate(date); }}
                  maximumDate={new Date()}
                />
              )}

              {/* Simulate Button */}
              <TouchableOpacity
                style={[styles.simBtn, (simLoading || !amount || !tenor) && { opacity: 0.6 }]}
                onPress={runSimulate}
                disabled={simLoading || !amount || !tenor}
              >
                {simLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="calculator" size={18} color="#FFF" />}
                <Text style={styles.simBtnText}>{simLoading ? 'Menghitung...' : 'Hitung Simulasi Kompen'}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Simulation Result */}
          {simulasi && (
            <View style={styles.simBox}>
              <Text style={styles.simTitle}>Hasil Simulasi Kompen</Text>

              {/* Old Loan */}
              <View style={styles.simSection}>
                <Text style={styles.simSectionTitle}>Pinjaman Lama</Text>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>No. Pinjaman</Text>
                  <Text style={styles.simValue}>{simulasi.existingLoan.loanNo}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Sisa Pokok</Text>
                  <Text style={styles.simValue}>{formatRp(simulasi.kompen.principalOutstanding)}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Penalti Pelunasan</Text>
                  <Text style={[styles.simValue, { color: '#D97706' }]}>{formatRp(simulasi.kompen.penaltyFee)}</Text>
                </View>
                <View style={[styles.simRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.simLabel, { fontWeight: '700' }]}>Total Kompen</Text>
                  <Text style={[styles.simValue, { fontWeight: '700', color: '#FBBF24' }]}>{formatRp(simulasi.kompen.totalKompen)}</Text>
                </View>
              </View>

              {/* New Loan */}
              <View style={styles.simSection}>
                <Text style={styles.simSectionTitle}>Pinjaman Baru</Text>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Plafon</Text>
                  <Text style={styles.simValue}>{formatRp(simulasi.newLoan.principalAmount)}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Bunga / bulan ({simulasi.newLoan.interestRate}%)</Text>
                  <Text style={styles.simValue}>{formatRp(Math.round(simulasi.newLoan.principalAmount * simulasi.newLoan.interestRate / 100))}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Tenor</Text>
                  <Text style={styles.simValue}>{simulasi.newLoan.tenorMonths} bulan</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Angsuran / bulan</Text>
                  <Text style={styles.simValue}>{formatRp(simulasi.newLoan.monthlyInstallment)}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Total Bunga</Text>
                  <Text style={styles.simValue}>{formatRp(simulasi.newLoan.totalInterest)}</Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={styles.simLabel}>Biaya Admin</Text>
                  <Text style={styles.simValue}>{formatRp(simulasi.summary.biayaAdmin)}</Text>
                </View>
              </View>

              {/* Bottom line: Dana diterima */}
              <View style={{ backgroundColor: '#065F46', padding: 14, borderRadius: 10, marginTop: 4 }}>
                <Text style={{ color: '#6EE7B7', fontSize: 12, fontWeight: '600' }}>Dana Diterima Anggota (Bersih)</Text>
                <Text style={{ color: '#34D399', fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                  {formatRp(simulasi.summary.danaDiterimaAnggota)}
                </Text>
                <Text style={{ color: '#6EE7B7', fontSize: 11, marginTop: 2 }}>
                  Plafon {formatRp(simulasi.summary.plafonBaru)} - Kompen {formatRp(simulasi.summary.totalKompen)} - Admin {formatRp(simulasi.summary.biayaAdmin)}
                </Text>
              </View>
            </View>
          )}

          {/* Submit */}
          {simulasi && (
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="swap-horizontal" size={20} color="#FFF" />}
              <Text style={styles.submitText}>{submitting ? 'Memproses...' : 'Proses Kompen Sekarang'}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Member Search Modal */}
      <Modal visible={memberModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMemberModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFF', padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Cari Anggota</Text>
            <TouchableOpacity onPress={() => setMemberModal(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
          </View>
          <TextInput
            style={styles.input} placeholder="Ketik nama atau NRP..."
            autoFocus value={searchMember} onChangeText={setSearchMember}
          />
          {searching && <ActivityIndicator style={{ marginTop: 20 }} color="#7C3AED" />}
          <FlatList
            data={members}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ marginTop: 12, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ padding: 16, borderBottomWidth: 1, borderColor: '#F1F5F9' }}
                onPress={() => onMemberSelected(item)}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.primary }}>{item.name}</Text>
                <Text style={{ color: C.mutedForeground }}>{item.nrp || item.memberNo}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  form: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: C.foreground, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.foreground, borderWidth: 1, borderColor: C.border,
  },
  selectorBtn: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center',
  },
  loanCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginTop: 8,
    borderWidth: 2, borderColor: C.border,
  },
  loanCardActive: { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  chipText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
  chipTextActive: { color: '#6D28D9' },
  simBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED', paddingVertical: 14, borderRadius: 12, marginTop: 24,
  },
  simBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  simBox: {
    backgroundColor: '#0F172A', padding: 16, borderRadius: 14, marginTop: 20,
  },
  simTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  simSection: { marginBottom: 12 },
  simSectionTitle: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  simRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  simLabel: { color: '#94A3B8', fontSize: 13 },
  simValue: { color: '#F1F5F9', fontSize: 13, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 12, marginTop: 24,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
