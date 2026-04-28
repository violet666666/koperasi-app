import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import C from '../../lib/colors';
import { TextInput } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  code: string;
  name: string;
  interestRate: number;
  adminFeeValue: number;
  adminFeeType: string;
  maxAmount: number;
  maxTenor: number;
  minAmount?: number;
  minTenor?: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ── Zod Schema (dibuat dinamis berdasarkan produk yang dipilih) ────────────
const buildSchema = (product: Product | null) =>
  z.object({
    amount: z
      .string()
      .min(1, 'Jumlah pinjaman wajib diisi')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Masukkan angka yang valid')
      .refine(
        (v) => !product || Number(v) >= (product.minAmount ?? 0),
        { message: product ? `Minimum pinjaman ${formatRp(product.minAmount ?? 0)}` : 'Pilih produk terlebih dahulu' }
      )
      .refine(
        (v) => !product || Number(v) <= product.maxAmount,
        { message: product ? `Maksimum pinjaman ${formatRp(product.maxAmount)}` : '' }
      ),
    tenor: z
      .string()
      .min(1, 'Tenor wajib diisi')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Masukkan angka yang valid')
      .refine(
        (v) => !product || Number(v) >= (product.minTenor ?? 1),
        { message: product ? `Minimum tenor ${product.minTenor ?? 1} bulan` : '' }
      )
      .refine(
        (v) => !product || Number(v) <= product.maxTenor,
        { message: product ? `Maksimum tenor ${product.maxTenor} bulan` : '' }
      ),
    purpose: z.string().min(5, 'Tujuan pinjaman minimal 5 karakter'),
  });

type LoanFormData = { amount: string; tenor: string; purpose: string };

// ── Main Component ─────────────────────────────────────────────────────────
export default function LoanApplicationScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(buildSchema(selectedProduct)),
    defaultValues: { amount: '', tenor: '', purpose: '' },
    mode: 'onChange',
  });

  const amountVal = watch('amount');
  const tenorVal = watch('tenor');

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await api.get('/api/mobile/loan-apply');
        const prods = res.data.data || [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0]);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Gagal', text2: err.message || 'Gagal memuat produk pinjaman' });
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  // ── Kalkulasi Simulasi ──────────────────────────────────────────────────
  const getInterestRate = () => selectedProduct ? Number(selectedProduct.interestRate) / 100 : 0;
  const getAdminFeeRate = () => selectedProduct ? Number(selectedProduct.adminFeeValue) / 100 : 0;

  const monthlyInstallment = () => {
    const amt = parseFloat(amountVal);
    const tnr = parseInt(tenorVal);
    if (!amt || !tnr) return 0;
    return Math.round(amt * getInterestRate()) + Math.round(amt / tnr);
  };

  const adminFeeAmount = () => {
    const amt = parseFloat(amountVal);
    if (!amt) return 0;
    return Math.round(amt * getAdminFeeRate());
  };

  const disbursedAmount = () => {
    const amt = parseFloat(amountVal);
    if (!amt) return 0;
    return amt - adminFeeAmount();
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const onSubmit = async (data: LoanFormData) => {
    if (!selectedProduct) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const amt = parseFloat(data.amount);
    const tnr = parseInt(data.tenor);

    setSubmitting(true);
    try {
      await api.post('/api/mobile/loan-apply', {
        productId: selectedProduct.id,
        amount: amt,
        tenorMonths: tnr,
        purpose: data.purpose,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Pengajuan Terkirim!', text2: 'Menunggu persetujuan dari admin.' });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.message || err.response?.data?.message || 'Gagal mengajukan pinjaman' });
    } finally {
      setSubmitting(false);
    }
  };

  const onError = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengajuan Pinjaman</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} key={selectedProduct?.id || 'none'}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

          {/* Pilih Produk */}
          <Text style={styles.sectionLabel}>Pilih Produk Pinjaman</Text>
          {loadingProducts ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={C.primary} />
              <Text style={{ color: C.mutedForeground, marginTop: 8 }}>Memuat produk...</Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginBottom: 16 }}>
              {products.map((prod) => {
                const isSelected = selectedProduct?.id === prod.id;
                return (
                  <TouchableOpacity
                    key={prod.id}
                    style={[styles.productCard, isSelected && styles.productSelected]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedProduct(prod);
                      reset({ amount: '', tenor: '', purpose: '' });
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.productName, isSelected && { color: C.accent }]}>{prod.name}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={C.accent} />}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      <View style={styles.infoPill}>
                        <Text style={styles.infoPillText}>Maks. {formatRp(prod.maxAmount)}</Text>
                      </View>
                      <View style={styles.infoPill}>
                        <Text style={styles.infoPillText}>Maks. {prod.maxTenor} bln</Text>
                      </View>
                      <View style={styles.infoPill}>
                        <Text style={styles.infoPillText}>Bunga {prod.interestRate}% flat/bln</Text>
                      </View>
                      <View style={[styles.infoPill, { backgroundColor: '#FFF7ED' }]}>
                        <Text style={[styles.infoPillText, { color: '#EA580C' }]}>Resiko {prod.adminFeeValue}%</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedProduct && (
            <>
              {/* ── Jumlah Pinjaman ── */}
              <Text style={styles.label}>Jumlah Pinjaman (Rp)</Text>
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.amount && styles.inputError]}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    placeholder={`Maks: ${formatRp(selectedProduct.maxAmount)}`}
                    placeholderTextColor="#94A3B8"
                  />
                )}
              />
              {errors.amount && (
                <Text style={styles.errorText}>
                  <Ionicons name="alert-circle-outline" size={12} /> {errors.amount.message}
                </Text>
              )}

              {/* ── Tenor ── */}
              <Text style={styles.label}>Tenor (Bulan)</Text>
              <Controller
                control={control}
                name="tenor"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors.tenor && styles.inputError]}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    placeholder={`Maks: ${selectedProduct.maxTenor} Bulan`}
                    placeholderTextColor="#94A3B8"
                  />
                )}
              />
              {errors.tenor && (
                <Text style={styles.errorText}>
                  <Ionicons name="alert-circle-outline" size={12} /> {errors.tenor.message}
                </Text>
              )}

              {/* ── Tujuan ── */}
              <Text style={styles.label}>Tujuan Pinjaman</Text>
              <Controller
                control={control}
                name="purpose"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }, errors.purpose && styles.inputError]}
                    multiline
                    value={value}
                    onChangeText={onChange}
                    placeholder="Minimal 5 karakter, contoh: renovasi rumah"
                    placeholderTextColor="#94A3B8"
                  />
                )}
              />
              {errors.purpose && (
                <Text style={styles.errorText}>
                  <Ionicons name="alert-circle-outline" size={12} /> {errors.purpose.message}
                </Text>
              )}

              {/* ── Preview Simulasi Dinamis ── */}
              {amountVal && tenorVal && !errors.amount && !errors.tenor && (
                <View style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Jumlah Pinjaman</Text>
                    <Text style={styles.previewValue}>{formatRp(Number(amountVal))}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Potongan Resiko ({selectedProduct.adminFeeValue}%)</Text>
                    <Text style={[styles.previewValue, { color: '#F87171' }]}>- {formatRp(adminFeeAmount())}</Text>
                  </View>
                  <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12, marginTop: 4 }]}>
                    <Text style={[styles.previewLabel, { fontWeight: 'bold', color: '#FFF' }]}>Dana Cair (Bersih)</Text>
                    <Text style={[styles.previewValue, { color: '#4ADE80', fontSize: 18 }]}>{formatRp(disbursedAmount())}</Text>
                  </View>
                  <View style={[styles.previewRow, { marginTop: 12 }]}>
                    <Text style={styles.previewLabel}>Angsuran / Bulan ({tenorVal} bln)</Text>
                    <Text style={styles.previewValue}>{formatRp(monthlyInstallment())}</Text>
                  </View>
                  <Text style={styles.previewNote}>
                    Pokok/bln + Bunga {selectedProduct.interestRate}% flat/bln
                  </Text>
                </View>
              )}

              {/* ── Tombol Submit ── */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit(onSubmit, onError)}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Ionicons name="send" size={18} color="#FFF" />}
                <Text style={styles.submitText}>{submitting ? 'Mengirim...' : 'Ajukan Pinjaman'}</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionLabel: { fontSize: 15, fontWeight: '700', color: C.foreground, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: C.foreground, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.foreground, borderWidth: 1, borderColor: C.border,
  },
  inputError: {
    borderColor: '#EF4444', borderWidth: 1.5,
  },
  errorText: {
    color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4,
  },
  productCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    borderWidth: 2, borderColor: C.border,
  },
  productSelected: { borderColor: C.accent, backgroundColor: C.accentBg || '#F0FDF4' },
  productName: { fontSize: 16, fontWeight: '700', color: C.primary },
  infoPill: {
    backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  infoPillText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  previewCard: {
    backgroundColor: C.primary, borderRadius: 16, padding: 20, marginTop: 24,
  },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  previewLabel: { fontSize: 13, color: C.mutedForeground },
  previewValue: { fontSize: 14, fontWeight: 'bold', color: C.accent },
  previewNote: { fontSize: 12, color: C.mutedForeground, marginTop: 4, textAlign: 'center' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, marginTop: 24,
  },
  submitText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
