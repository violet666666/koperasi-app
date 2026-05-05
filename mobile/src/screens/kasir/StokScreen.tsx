import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import { StorageManager } from '../../lib/storage';
import C from '../../lib/colors';

interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  costPrice?: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function StokScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stock-in modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [siQty, setSiQty] = useState('');
  const [siHpp, setSiHpp] = useState('');
  const [siBatchNo, setSiBatchNo] = useState('');
  const [siExpiry, setSiExpiry] = useState('');
  const [siSupplier, setSiSupplier] = useState('');
  const [siSubmitting, setSiSubmitting] = useState(false);

  const getUnitFilter = useCallback(() => {
    const u = StorageManager.getFastString('userData');
    if (u) {
      try {
        const user = JSON.parse(u);
        if (user.role?.name === 'kasir' && user.unitType) return user.unitType;
      } catch (e) {}
    }
    return null;
  }, []);

  const loadData = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const unitType = getUnitFilter();
      const unitParam = unitType ? `&unitType=${unitType}` : '';
      const searchTerm = q ?? '';
      const res = await api.get(`/api/mobile/toko?search=${searchTerm}${unitParam}`);
      setProducts(res.data.data || []);
    } catch (err) {
      console.log('Stok fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getUnitFilter]);

  useEffect(() => { loadData(''); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(search); setRefreshing(false); };
  const handleSearch = () => { loadData(search); };

  const openStockIn = (product: Product) => {
    setSelectedProduct(product);
    setSiQty('');
    setSiHpp(String(product.costPrice || ''));
    setSiBatchNo('');
    setSiExpiry('');
    setSiSupplier('');
    setModalVisible(true);
  };

  const submitStockIn = async () => {
    if (!selectedProduct) return;
    const qty = parseInt(siQty);
    if (!qty || qty <= 0) return Alert.alert('Error', 'Jumlah harus lebih dari 0');
    setSiSubmitting(true);
    try {
      await api.post('/api/mobile/toko/stock-in', {
        productId: selectedProduct.id,
        quantity: qty,
        purchasePrice: siHpp ? parseFloat(siHpp) : undefined,
        batchNo: siBatchNo || undefined,
        expiryDate: siExpiry || undefined,
        supplierName: siSupplier || undefined,
      });
      Alert.alert('Berhasil', `Stok ${selectedProduct.name} ditambah ${qty}`);
      setModalVisible(false);
      loadData(search);
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Stok masuk gagal');
    } finally {
      setSiSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.card} onPress={() => openStockIn(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={[styles.stockBadge, item.stock <= 5 && styles.stockBadgeLow]}>
          Stok: {item.stock} {item.unit}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.skuText}>SKU: {item.sku}</Text>
        <Text style={styles.priceText}>{formatRp(item.price)}</Text>
      </View>
      {item.costPrice ? (
        <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 4 }}>HPP: {formatRp(item.costPrice)}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {canGoBack && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Persediaan Stok</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / SKU..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>Memuat persediaan...</Text></View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Produk tidak ditemukan</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}

      {/* Stock-In Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Stok Masuk</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={C.mutedForeground} />
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground, marginBottom: 12 }}>
                  {selectedProduct.name} (Stok: {selectedProduct.stock})
                </Text>
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Jumlah *</Text>
                <TextInput style={styles.fieldInput} keyboardType="numeric" value={siQty} onChangeText={setSiQty} placeholder="0" placeholderTextColor={C.mutedForeground} />

                <Text style={styles.fieldLabel}>HPP / Harga Beli</Text>
                <TextInput style={styles.fieldInput} keyboardType="numeric" value={siHpp} onChangeText={setSiHpp} placeholder="Opsional" placeholderTextColor={C.mutedForeground} />

                <Text style={styles.fieldLabel}>No. Batch</Text>
                <TextInput style={styles.fieldInput} value={siBatchNo} onChangeText={setSiBatchNo} placeholder="Opsional" placeholderTextColor={C.mutedForeground} />

                <Text style={styles.fieldLabel}>Tanggal Expired (YYYY-MM-DD)</Text>
                <TextInput style={styles.fieldInput} value={siExpiry} onChangeText={setSiExpiry} placeholder="2026-12-31" placeholderTextColor={C.mutedForeground} />

                <Text style={styles.fieldLabel}>Nama Supplier</Text>
                <TextInput style={styles.fieldInput} value={siSupplier} onChangeText={setSiSupplier} placeholder="Opsional" placeholderTextColor={C.mutedForeground} />
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, siSubmitting && { opacity: 0.6 }]}
                onPress={submitStockIn}
                disabled={siSubmitting}
              >
                {siSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Tambah Stok</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: '#FFF',
  },
  searchBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 12, justifyContent: 'center' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  productName: { fontSize: 16, fontWeight: '600', color: C.foreground, flex: 1, marginRight: 8 },
  stockBadge: { backgroundColor: C.successBg, color: C.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  stockBadgeLow: { backgroundColor: C.destructiveBg, color: C.destructive },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skuText: { fontSize: 13, color: C.mutedForeground },
  priceText: { fontSize: 15, fontWeight: '600', color: C.primary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: C.foreground },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.mutedForeground, marginBottom: 4, marginTop: 10 },
  fieldInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.foreground },
  submitBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
