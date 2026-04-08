import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

// ── Types ──────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  code: string;
  name: string;
  interestRate: number;
  adminFeeValue: number;   // S2-01: dari DB, bukan hardcode 2%
  adminFeeType: string;
  maxAmount: number;
  maxTenor: number;
  minAmount?: number;
  minTenor?: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ── Main Component ─────────────────────────────────────────────────────────
export default function LoanApplicationScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await api.get('/api/mobile/loan-apply');
        const prods = res.data.data || [];
        setProducts(prods);
        if (prods.length > 0 && !selectedProduct) {
          setSelectedProduct(prods[0]);
        }
      } catch (err: any) {
        console.log('Load products error:', err);
        Alert.alert('Error', err.message || 'Gagal memuat produk pinjaman');
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  // S2-01: Kalkulasi dinamis dari data produk — TIDAK hardcode
  const getInterestRate = () => selectedProduct ? Number(selectedProduct.interestRate) / 100 : 0;
  const getAdminFeeRate = () => selectedProduct ? Number(selectedProduct.adminFeeValue) / 100 : 0;

  const monthlyInstallment = () => {
    if (!selectedProduct || !amount || !tenor) return 0;
    const amt = parseFloat(amount);
    const tnr = parseInt(tenor);
    if (!amt || !tnr) return 0;
    const interestPerMonth = Math.round(amt * getInterestRate());
    const principalPerMonth = Math.round(amt / tnr);
    return principalPerMonth + interestPerMonth;
  };

  const adminFeeAmount = () => {
    if (!amount) return 0;
    const amt = parseFloat(amount);
    if (!amt) return 0;
    return Math.round(amt * getAdminFeeRate());
  };

  const disbursedAmount = () => {
    const amt = parseFloat(amount);
    if (!amt) return 0;
    return amt - adminFeeAmount();
  };

  // S2-01: Validasi berdasarkan produk yang dipilih
  const handleAmountChange = (val: string) => {
    if (!selectedProduct) { setAmount(val); return; }
    const num = Number(val);
    if (num > selectedProduct.maxAmount) setAmount(String(selectedProduct.maxAmount));
    else setAmount(val);
  };

  const handleTenorChange = (val: string) => {
    if (!selectedProduct) { setTenor(val); return; }
    const num = Number(val);
    if (num > selectedProduct.maxTenor) setTenor(String(selectedProduct.maxTenor));
    else setTenor(val);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('Peringatan', 'Sistem sedang memuat konfigurasi pinjaman. Cobalah beberapa saat lagi.');
      return;
    }
    if (!amount || !tenor || !purpose) {
      Alert.alert('Peringatan', 'Lengkapi semua data');
      return;
    }

    const amt = parseFloat(amount);
    const tnr = parseInt(tenor);

    if (amt > selectedProduct.maxAmount) {
      Alert.alert('Limit', `Jumlah melebihi plafon maksimal ${formatRp(selectedProduct.maxAmount)}`);
      return;
    }
    if (tnr > selectedProduct.maxTenor) {
      Alert.alert('Limit', `Tenor maksimal ${selectedProduct.maxTenor} bulan`);
      return;
    }

    Alert.alert(
      'Konfirmasi Pengajuan',
      `Produk: ${selectedProduct.name}\nJumlah: ${formatRp(amt)}\nTenor: ${tnr} bulan\nAngsuran ~${formatRp(monthlyInstallment())}/bulan\n\nDana Cair: ${formatRp(disbursedAmount())}\n(setelah potongan resiko ${selectedProduct.adminFeeValue}%)`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ajukan Sekarang',
          onPress: async () => {
            setLoading(true);
            try {
              await api.post('/api/mobile/loan-apply', {
                productId: selectedProduct.id,
                amount: amt,
                tenorMonths: tnr,
                purpose,
              });
              Alert.alert('Berhasil', 'Pengajuan pinjaman berhasil dibuat dan menunggu persetujuan.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Gagal', err.message || err.response?.data?.message || 'Gagal mengajukan pinjaman');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

          {/* S2-01: Kartu pilih produk dinamis */}
          <Text style={styles.sectionLabel}>Pilih Produk Pinjaman</Text>
          {loadingProducts ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: C.mutedForeground }}>Memuat produk...</Text>
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
                      setSelectedProduct(prod);
                      setAmount('');
                      setTenor('');
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
              {/* Jumlah */}
              <Text style={styles.label}>Jumlah Pinjaman (Rp)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={handleAmountChange}
                placeholder={`Maks: ${formatRp(selectedProduct.maxAmount)}`}
                placeholderTextColor="#94A3B8"
              />

              {/* Tenor */}
              <Text style={styles.label}>Tenor (Bulan)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={tenor}
                onChangeText={handleTenorChange}
                placeholder={`Maks: ${selectedProduct.maxTenor} Bulan`}
                placeholderTextColor="#94A3B8"
              />

              {/* Tujuan */}
              <Text style={styles.label}>Tujuan Pinjaman</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Opsional: keperluan apa?"
                placeholderTextColor="#94A3B8"
              />

              {/* S2-01: Preview simulasi dinamis */}
              {amount && tenor && (
                <View style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Jumlah Pinjaman</Text>
                    <Text style={styles.previewValue}>{formatRp(Number(amount))}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Potongan Resiko ({selectedProduct.adminFeeValue}%)</Text>
                    <Text style={[styles.previewValue, { color: '#EF4444' }]}>- {formatRp(adminFeeAmount())}</Text>
                  </View>
                  <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 12, marginTop: 4 }]}>
                    <Text style={[styles.previewLabel, { fontWeight: 'bold', color: '#FFF' }]}>Dana Cair (Bersih)</Text>
                    <Text style={[styles.previewValue, { color: '#4ADE80', fontSize: 18 }]}>{formatRp(disbursedAmount())}</Text>
                  </View>
                  <View style={[styles.previewRow, { marginTop: 12 }]}>
                    <Text style={styles.previewLabel}>Angsuran / Bulan ({tenor} bln)</Text>
                    <Text style={styles.previewValue}>{formatRp(monthlyInstallment())}</Text>
                  </View>
                  <Text style={styles.previewNote}>
                    Pokok/bln + Bunga {selectedProduct.interestRate}% flat/bln
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Ionicons name="send" size={18} color="#FFF" />
                <Text style={styles.submitText}>{loading ? 'Mengirim...' : 'Ajukan Pinjaman'}</Text>
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
