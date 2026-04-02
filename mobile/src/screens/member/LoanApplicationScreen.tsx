import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Product {
  id: number;
  code: string;
  name: string;
  interestRate: number;
  adminFee: number;
  maxAmount: number;
  maxTenor: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function LoanApplicationScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [amount, setAmount] = useState('');
  const [tenor, setTenor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/api/mobile/loan-apply');
        const prods = res.data.data || [];
        setProducts(prods);
        if (prods.length > 0 && !selectedProduct) {
            setSelectedProduct(prods[0]);
        }
      } catch (err) {
        console.log('Load products error:', err);
      }
    };
    loadProducts();
  }, []);

  const monthlyInstallment = () => {
    if (!selectedProduct || !amount || !tenor) return 0;
    const amt = parseFloat(amount);
    const tnr = parseInt(tenor);
    if (!amt || !tnr) return 0;
    
    // Bunga 0.3% per bulan flat
    const interestPerMonth = Math.round(amt * 0.003);
    const principalPerMonth = Math.round(amt / tnr);
    return principalPerMonth + interestPerMonth;
  };

  const adminFee = () => {
    if (!amount) return 0;
    const amt = parseFloat(amount);
    if (!amt) return 0;
    return Math.round(amt * 0.02); // Potongan Resiko 2%
  };

  const disbursedAmount = () => {
    const amt = parseFloat(amount);
    if (!amt) return 0;
    return amt - adminFee(); // Disbursed: Plafon - Potongan Resiko
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
      `Anda akan mengajukan pinjaman sebesar ${formatRp(amt)} dengan angsuran ~${formatRp(monthlyInstallment())}/bulan selama ${tnr} bulan.\n\nDana cair dibayar sebesar ${formatRp(disbursedAmount())} setelah potongan resiko 2%.`,
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
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal mengajukan pinjaman');
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
          {/* Info Banner Konfigurasi Pinjaman (pengganti pilih produk) */}
          <View style={[styles.productCard, { backgroundColor: C.infoBg, borderColor: C.info, borderWidth: 1, marginBottom: 16 }]}>
            <Text style={[styles.productName, { color: C.info }]}>Aturan Pinjaman PRIMKOPPOL</Text>
            <Text style={[styles.productInfo, { color: '#000' }]}>• Bunga Pinjaman: 0.3% Flat / bulan</Text>
            <Text style={[styles.productInfo, { color: '#000' }]}>• Potongan Resiko: 2% (di depan)</Text>
            {selectedProduct && (
              <Text style={[styles.productInfo, { color: '#000', marginTop: 4 }]}>
                (Max. Pinjaman {formatRp(20000000)} | Tenor 36 bln)
              </Text>
            )}
            {!selectedProduct && (
              <Text style={[styles.productInfo, { color: '#EF4444', marginTop: 4 }]}>
                Memuat konfigurasi sistem...
              </Text>
            )}
          </View>

          {/* Jumlah */}
          <Text style={styles.label}>Jumlah Pinjaman (Rp)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={(val) => {
              const num = Number(val);
              if (num > 20000000) setAmount("20000000");
              else setAmount(val);
            }}
            placeholder="Maks: Rp 20.000.000"
            placeholderTextColor="#94A3B8"
          />

          {/* Tenor */}
          <Text style={styles.label}>Tenor (Bulan)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={tenor}
            onChangeText={(val) => {
              const num = Number(val);
              if (num > 36) setTenor("36");
              else setTenor(val);
            }}
            placeholder="Maks: 36 Bulan"
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

          {/* Preview */}
          {selectedProduct && amount && tenor && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Terima Bersih (Plafon - 2% Resiko)</Text>
              <Text style={[styles.previewAmount, { color: '#4ADE80' }]}>{formatRp(disbursedAmount())}</Text>
              <Text style={[styles.previewNote, { marginTop: 16 }]}>
                Angsuran per Bulan (Selama {tenor} bln)
              </Text>
              <Text style={styles.previewAmount}>{formatRp(monthlyInstallment())}</Text>
              <Text style={styles.previewNote}>
                Rincian = Angsuran Pokok + Bunga Flat 0.3%/bln
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            <Ionicons name="send" size={18} color="#FFF" />
            <Text style={styles.submitText}>{loading ? 'Mengirim...' : 'Ajukan Pinjaman'}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
  label: { fontSize: 14, fontWeight: '600', color: C.foreground, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.foreground, borderWidth: 1, borderColor: C.border,
  },
  productList: { gap: 8 },
  productCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: C.border,
  },
  productSelected: { borderColor: C.accent, backgroundColor: C.accentBg },
  productName: { fontSize: 15, fontWeight: '700', color: C.primary },
  productInfo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  previewCard: {
    backgroundColor: C.primary, borderRadius: 16, padding: 20, marginTop: 24, alignItems: 'center',
  },
  previewTitle: { fontSize: 13, color: C.mutedForeground },
  previewAmount: { fontSize: 24, fontWeight: 'bold', color: C.accent, marginTop: 4 },
  previewNote: { fontSize: 12, color: C.mutedForeground, marginTop: 8, textAlign: 'center' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, marginTop: 24,
  },
  submitText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
  emptyText: { fontSize: 14, color: C.mutedForeground, textAlign: 'center', paddingVertical: 20 },
});
