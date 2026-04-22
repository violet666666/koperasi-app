import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  TextInput, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../lib/api';
import C from '../../lib/colors';

// ── Types ──────────────────────────────────────────────────────────────────
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
interface CashBankAccount {
  id: number;
  code: string;
  name: string;
  type: 'cash' | 'bank';
  currentBalance: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ── Zod Schema ─────────────────────────────────────────────────────────────
const buildSchema = (product: Product | null, member: Member | null) =>
  z.object({
    amount: z
      .string()
      .min(1, 'Jumlah wajib')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Wajib angka')
      .refine((v) => !product || Number(v) >= (product.minAmount ?? 0), 'Di bawah minimal')
      .refine((v) => !product || Number(v) <= product.maxAmount, 'Melebihi batas produk'),
    tenor: z
      .string()
      .min(1, 'Tenor wajib')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Wajib angka')
      .refine((v) => !product || Number(v) >= (product.minTenor ?? 1), 'Tenor kurang')
      .refine((v) => !product || Number(v) <= product.maxTenor, 'Melebihi batas tenor produk'),
  });

export default function DirectDisburseScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Member Search State
  const [memberModal, setMemberModal] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searching, setSearching] = useState(false);

  // Date State
  const [backdatedDate, setBackdatedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [selectedCashBankId, setSelectedCashBankId] = useState<number | null>(null);
  const [showCashBankPicker, setShowCashBankPicker] = useState(false);
  const [deductionSource, setDeductionSource] = useState<'gaji' | 'tunkin' | 'bs'>('gaji');

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(buildSchema(selectedProduct, selectedMember)),
    defaultValues: { amount: '', tenor: '' },
    mode: 'onChange',
  });

  const amountVal = watch('amount');
  const tenorVal = watch('tenor');

  // Load Products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/api/mobile/loan-apply');
        const prods = res.data.data || [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0]);
      } catch (err) {
        console.error(err);
      }
    };
    loadProducts();
    // Load Kas/Bank accounts
    api.get('/api/mobile/kas-bank').then((res) => {
      const accounts = res.data?.data || [];
      setCashBankAccounts(accounts);
      if (accounts.length > 0) {
        const kas = accounts.find((a: CashBankAccount) => a.type === 'cash') || accounts[0];
        setSelectedCashBankId(kas.id);
      }
    }).catch(() => {});
  }, []);

  // Search Member Trigger
  useEffect(() => {
    if (searchMember.length > 1) {
      const delay = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await api.get(`/api/mobile/members?search=${searchMember}&limit=10`);
          setMembers(res.data.data || []);
        } finally {
          setSearching(false);
        }
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setMembers([]);
    }
  }, [searchMember]);

  const selectedCashBank = cashBankAccounts.find(a => a.id === selectedCashBankId);

  const onSubmit = async (data: any) => {
    if (!selectedProduct || !selectedMember) {
      Toast.show({ type: 'error', text1: 'Lengkapi Data', text2: 'Pilih anggota dan produk!' });
      return;
    }
    if (!selectedCashBankId) {
      Toast.show({ type: 'error', text1: 'Pilih Kas/Bank', text2: 'Pilih akun kas/bank untuk pencairan' });
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);
    try {
      const res = await api.post('/api/mobile/loans-operator/direct-disburse', {
        memberId: selectedMember.id,
        productId: selectedProduct.id,
        amount: parseFloat(data.amount),
        tenorMonths: parseInt(data.tenor),
        purpose: 'Pencairan Langsung dari Mobile',
        deductionSource,
        backdatedDate: backdatedDate.toISOString(),
        cashBankAccountId: selectedCashBankId,
      });
      
      Toast.show({ type: 'success', text1: 'Sukses Cair!', text2: res.data.message });
      navigation.replace('KwitansiViewer', { receiptId: res.data.receiptId });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.response?.data?.message || err.message });
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pencairan Langsung</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.label}>1. Pilih Anggota</Text>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setMemberModal(true)}>
            <Text style={{ color: selectedMember ? C.foreground : C.mutedForeground, flex: 1 }}>
              {selectedMember ? `${selectedMember.name} (${selectedMember.nrp || selectedMember.memberNo})` : 'Ketuk untuk cari anggota...'}
            </Text>
            <Ionicons name="search" size={20} color={C.mutedForeground} />
          </TouchableOpacity>

          <Text style={styles.label}>2. Pilih Produk Pinjaman</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {products.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, selectedProduct?.id === p.id && styles.chipActive]}
                onPress={() => setSelectedProduct(p)}
              >
                <Text style={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nominal (Rp)</Text>
              <Controller
                control={control} name="amount"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.amount && styles.inputError]}
                    keyboardType="numeric" value={value} onChangeText={onChange}
                    placeholder="Contoh: 5000000"
                  />
                )}
              />
              {errors.amount && <Text style={styles.errorText}>{(errors.amount as any).message}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tenor (Bulan)</Text>
              <Controller
                control={control} name="tenor"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.tenor && styles.inputError]}
                    keyboardType="numeric" value={value} onChangeText={onChange}
                    placeholder="Maks: 36"
                  />
                )}
              />
              {errors.tenor && <Text style={styles.errorText}>{(errors.tenor as any).message}</Text>}
            </View>
          </View>

          <Text style={styles.label}>Tanggal Pencairan (Mundur)</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
             <Text>{backdatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={backdatedDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setBackdatedDate(date);
              }}
              maximumDate={new Date()}
            />
          )}

          {/* ═══ Sumber Pemotongan Angsuran ═══ */}
          <Text style={styles.label}>4. Sumber Pemotongan Angsuran</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'gaji' as const, label: '💵 Pot Gaji', desc: 'Dipotong dari gaji' },
              { key: 'tunkin' as const, label: '🏅 Pot Tunkin', desc: 'Dipotong dari Tunjangan Kinerja' },
              { key: 'bs' as const, label: '🧾 Bayar Sendiri', desc: 'Anggota bayar langsung' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.chip, { paddingHorizontal: 14, paddingVertical: 10 },
                  deductionSource === opt.key && styles.chipActive,
                ]}
                onPress={() => setDeductionSource(opt.key)}
              >
                <Text style={[
                  styles.chipText,
                  deductionSource === opt.key && styles.chipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {deductionSource === 'bs' && (
            <Text style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
              ⚠️ Anggota membayar angsuran sendiri. Validasi pendapatan tidak berlaku.
            </Text>
          )}

          {/* Quick Summary */}
          {amountVal && tenorVal && !errors.amount && !errors.tenor && selectedProduct && (
            <View style={styles.summaryBox}>
               <Text style={styles.summaryTitle}>Simulasi Singkat</Text>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: '#FFF' }}>Dana Diterima (Bersih)</Text>
                  <Text style={{ color: '#4ADE80', fontWeight: 'bold' }}>
                    {formatRp(Number(amountVal) - (Number(amountVal) * selectedProduct.adminFeeValue / 100))}
                  </Text>
               </View>
            </View>
          )}

          {/* Kas/Bank Picker */}
          <Text style={styles.label}>6. Tujuan Kas / Bank *</Text>
          <TouchableOpacity
            style={[styles.selectorBtn, { justifyContent: 'space-between' }]}
            onPress={() => setShowCashBankPicker(!showCashBankPicker)}
          >
            <Text style={{ color: selectedCashBank ? C.foreground : C.mutedForeground, flex: 1 }}>
              {selectedCashBank ? `${selectedCashBank.type === 'cash' ? '💵' : '🏦'} ${selectedCashBank.name}` : 'Pilih Kas/Bank...'}
            </Text>
            <Ionicons name={showCashBankPicker ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
          </TouchableOpacity>
          {showCashBankPicker && (
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginTop: 8, overflow: 'hidden' }}>
              {cashBankAccounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                    selectedCashBankId === acc.id && { backgroundColor: '#DBEAFE' }
                  ]}
                  onPress={() => { setSelectedCashBankId(acc.id); setShowCashBankPicker(false); }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>
                      {acc.type === 'cash' ? '💵' : '🏦'} {acc.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>Saldo: {formatRp(acc.currentBalance)}</Text>
                  </View>
                  {selectedCashBankId === acc.id && <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !selectedCashBankId) && { opacity: 0.7 }]}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting || !selectedCashBankId}
          >
             {submitting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="flash" size={20} color="#FFF" />}
             <Text style={styles.submitText}>{submitting ? 'Memproses...' : 'Cairkan Pinjaman Sekarang'}</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Member Modal */}
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
            {searching && <ActivityIndicator style={{ marginTop: 20 }} />}
            <FlatList
               data={members}
               keyExtractor={(item) => item.id.toString()}
               contentContainerStyle={{ marginTop: 12, paddingBottom: 40 }}
               renderItem={({ item }) => (
                 <TouchableOpacity 
                   style={{ padding: 16, borderBottomWidth: 1, borderColor: '#F1F5F9' }}
                   onPress={() => {
                     setSelectedMember(item);
                     setMemberModal(false);
                   }}
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
    backgroundColor: C.primary, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20,
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
    borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center'
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  chipText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
  chipTextActive: { color: '#1D4ED8' },
  summaryBox: {
    backgroundColor: '#0F172A', padding: 16, borderRadius: 12, marginTop: 24,
  },
  summaryTitle: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, marginTop: 24,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
