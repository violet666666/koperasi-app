import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TextInput, TouchableOpacity } from 'react-native';
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

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
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
    </View>
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
  emptyText: { fontSize: 15, color: C.mutedForeground }
});
