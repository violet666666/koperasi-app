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
        setProducts(res.data.data || []);
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
    return Math.round(amt / tnr); // Pokok saja, tanpa bunga per bulan
  };

  const adminFee = () => {
    if (!amount) return 0;
    const amt = parseFloat(amount);
    if (!amt) return 0;
    return Math.round(amt * 0.01); // 1% admin fee
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('Peringatan', 'Pilih jenis pinjaman terlebih dahulu');
      return;
    }
    const amt = parseFloat(amount);
    const tnr = parseInt(tenor);
    if (!amt || amt <= 0) {
      Alert.alert('Peringatan', 'Masukkan jumlah pinjaman yang valid');
      return;
    }
    if (!tnr || tnr <= 0) {
      Alert.alert('Peringatan', 'Masukkan tenor yang valid');
      return;
    }
    if (amt > selectedProduct.maxAmount) {
      Alert.alert('Peringatan', `Jumlah melebihi plafon maks ${formatRp(selectedProduct.maxAmount)}`);
      return;
    }
    if (tnr > selectedProduct.maxTenor) {
      Alert.alert('Peringatan', `Tenor melebihi maks ${selectedProduct.maxTenor} bulan`);
      return;
    }

    Alert.alert(
      'Konfirmasi Pengajuan',
      `Pinjaman ${selectedProduct.name}\nJumlah: ${formatRp(amt)}\nTenor: ${tnr} bulan\nBiaya Jasa (1%): ${formatRp(adminFee())}\nAngsuran: ~${formatRp(monthlyInstallment())}/bln\n\nLanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ajukan',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await api.post('/api/mobile/loan-apply', {
                loanProductId: selectedProduct.id,
                amount: amt,
                tenor: tnr,
                purpose: purpose || 'Keperluan pribadi',
              });
              Alert.alert('Berhasil ✅', res.data.message, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
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
          {/* Pilih Produk */}
          <Text style={styles.label}>Jenis Pinjaman</Text>
          <View style={styles.productList}>
            {products.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.productCard, selectedProduct?.id === p.id && styles.productSelected]}
                onPress={() => setSelectedProduct(p)}
              >
                <Text style={[styles.productName, selectedProduct?.id === p.id && { color: C.accent }]}>
                  {p.name}
                </Text>
                <Text style={styles.productInfo}>Bunga 0% • Biaya Jasa 1%</Text>
                <Text style={styles.productInfo}>Plafon maks {formatRp(p.maxAmount)} • Tenor {p.maxTenor} bulan</Text>
              </TouchableOpacity>
            ))}
            {products.length === 0 && <Text style={styles.emptyText}>Memuat produk pinjaman...</Text>}
          </View>

          {/* Jumlah */}
          <Text style={styles.label}>Jumlah Pinjaman (Rp)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="Contoh: 5000000"
            placeholderTextColor="#94A3B8"
          />

          {/* Tenor */}
          <Text style={styles.label}>Tenor (Bulan)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={tenor}
            onChangeText={setTenor}
            placeholder="Contoh: 12"
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
              <Text style={styles.previewTitle}>Estimasi Angsuran</Text>
              <Text style={styles.previewAmount}>{formatRp(monthlyInstallment())} / bulan</Text>
              <Text style={styles.previewNote}>
                Angsuran Pokok Saja (Bunga 0%)
                {'\n'}
                Terpotong biaya jasa admin 1%: {formatRp(adminFee())}
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
