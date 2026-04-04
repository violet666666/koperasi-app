import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TextInput, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Product { id: number; sku: string; name: string; price: number; stock: number; unit: string; }
interface CartItem { product: Product; quantity: number; }
interface Member { id: number; name: string; nrp: string; }

const UNIT_TYPES = [
  { id: 'toko', name: 'Toko Sembako' },
  { id: 'resto_cafe', name: 'Resto & Cafe' },
  { id: 'cuci_mobil', name: 'Cuci Mobil & Mtr' },
  { id: 'barbershop', name: 'Barbershop' },
  { id: 'fotocopy', name: 'Fotocopy' },
];

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function KasirScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;
  
  const [unitType, setUnitType] = useState('toko');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Member Search State
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [searchingMember, setSearchingMember] = useState(false);

  const loadProducts = useCallback(async (q?: string, ut?: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/toko?search=${q ?? search}&unitType=${ut ?? unitType}`);
      setProducts(res.data.data || []);
    } catch (err) { console.log('Products fetch error:', err); }
    finally { setLoading(false); }
  }, [search, unitType]);

  useEffect(() => { loadProducts('', unitType); }, [unitType]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const newCart = [...prev];
        if (newCart[idx].quantity < product.stock) {
          newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + 1 };
        } else {
          Alert.alert('Stok Habis', `Stok ${product.name} tersisa ${product.stock}`);
        }
        return newCart;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev.map((c) => {
        if (c.product.id === productId) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.product.stock) { Alert.alert('Stok tidak cukup'); return c; }
          return { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  };

  const total = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);

  const performCheckoutAPI = async (method: string, memberId: number | null) => {
    setProcessing(true);
    try {
      await api.post('/api/mobile/toko', {
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity, price: c.product.price })),
        paymentMethod: method,
        unitType,
        memberId
      });
      
      const printedCart = [...cart];
      const printedTotal = total;
      
      setCart([]);
      setShowCart(false);
      setShowMemberModal(false);
      loadProducts(search, unitType);

      Alert.alert('Berhasil!', `Checkout ${formatRp(printedTotal)} sukses`, [
        { text: 'Tutup', style: 'cancel' },
        { text: 'Cetak Struk', onPress: () => printReceipt(method, printedCart, printedTotal) }
      ]);
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Terjadi kesalahan saat proses checkout');
    } finally { setProcessing(false); }
  };

  const handleCheckoutInit = (method: 'cash' | 'qris' | 'salary_cut') => {
    if (cart.length === 0) return;

    if (method === 'salary_cut') {
      setShowMemberModal(true); // Open member search
      setMemberSearch('');
      setMembers([]);
      return;
    }

    Alert.alert(
      `Checkout ${method === 'cash' ? 'Tunai' : 'QRIS'}?`,
      `Total: ${formatRp(total)}\n${cart.length} item`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Bayar', onPress: () => performCheckoutAPI(method, null) },
      ],
    );
  };

  const searchMembers = async (q: string) => {
    setMemberSearch(q);
    if (q.length < 2) return;
    setSearchingMember(true);
    try {
      const res = await api.get(`/api/mobile/members?search=${q}&limit=10`);
      setMembers(res.data.data || []);
    } catch (e) {
      console.log('Member search error', e);
    } finally {
      setSearchingMember(false);
    }
  };

  const printReceipt = async (method: string, items: CartItem[], amount: number) => {
    try {
      const headerTitle = UNIT_TYPES.find(u => u.id === unitType)?.name.toUpperCase() || "UNIT USAHA";
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Courier New', Courier, monospace; font-size: 14px; padding: 10px; text-align: center; }
              .header { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
              .sub { font-size: 12px; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
              .item-row { display: flex; justify-content: space-between; text-align: left; margin-bottom: 4px; font-size: 13px; }
              .item-name { max-width: 60%; }
              .total-section { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; }
              .footer { margin-top: 20px; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="header">PRIMKOPPOL LUMAJANG<br/>${headerTitle}</div>
            <div class="sub">
              Tgl: ${new Date().toLocaleString('id-ID')}<br/>
              Metode: ${method.toUpperCase()}<br/>
              Kasir: Mobile POS
            </div>
            
            ${items.map(c => `
              <div class="item-row">
                <div class="item-name">${c.product.name}<br/>${c.quantity} x ${c.product.price.toLocaleString('id-ID')}</div>
                <div>${(c.quantity * c.product.price).toLocaleString('id-ID')}</div>
              </div>
            `).join('')}

            <div class="total-section">
              <span>TOTAL</span>
              <span>Rp ${amount.toLocaleString('id-ID')}</span>
            </div>
            
            <div class="footer">
              Terima Kasih Atas Kunjungan Anda<br/>
              Barang yang sudah dibeli tidak dapat ditukar
            </div>
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (err) {
      console.log('Print error:', err);
    }
  };

  if (!showCart) {
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
            <Text style={styles.headerTitle}>🛒 Kasir Multi-Unit</Text>
          </View>
          
          {/* Unit Type Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexDirection: 'row' }}>
            {UNIT_TYPES.map(u => (
              <TouchableOpacity 
                key={u.id} 
                className="px-4 py-2 rounded-full mr-2"
                style={{ backgroundColor: unitType === u.id ? C.accent : 'rgba(255,255,255,0.2)' }}
                onPress={() => setUnitType(u.id)}
              >
                <Text style={{ color: unitType === u.id ? C.primary : '#FFF', fontWeight: unitType === u.id ? 'bold' : 'normal', fontSize: 13 }}>
                  {u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari produk..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => loadProducts(search, unitType)}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => loadProducts(search, unitType)}>
              <Ionicons name="search" size={20} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productSku}>{item.sku} • Stok: {item.stock} {item.unit}</Text>
              </View>
              <Text style={styles.productPrice}>{formatRp(item.price)}</Text>
              <Ionicons name="add-circle" size={28} color={C.accent} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => loadProducts(search, unitType)} colors={[C.accent]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{loading ? '⏳' : '📦'}</Text>
              <Text style={styles.emptyText}>{loading ? 'Memuat produk...' : 'Produk tidak ditemukan di unit ini'}</Text>
            </View>
          }
        />

        {cart.length > 0 && (
          <TouchableOpacity style={styles.cartFab} onPress={() => setShowCart(true)}>
            <Ionicons name="cart" size={24} color={C.primary} />
            <Text style={styles.cartFabText}>{cart.length} item • {formatRp(total)}</Text>
            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.reduce((s, c) => s + c.quantity, 0)}</Text></View>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setShowCart(false)}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Keranjang ({cart.length})</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        {cart.map((c) => (
          <View key={c.product.id} style={styles.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartItemName}>{c.product.name}</Text>
              <Text style={styles.cartItemPrice}>{formatRp(c.product.price)} × {c.quantity}</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity onPress={() => updateQty(c.product.id, -1)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={18} color={C.destructive} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{c.quantity}</Text>
              <TouchableOpacity onPress={() => updateQty(c.product.id, 1)} style={styles.qtyBtn}>
                <Ionicons name="add" size={18} color={C.success} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cartSubtotal}>{formatRp(c.product.price * c.quantity)}</Text>
          </View>
        ))}

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>{formatRp(total)}</Text>
        </View>

        <TouchableOpacity style={styles.cashBtn} onPress={() => handleCheckoutInit('cash')} disabled={processing}>
          <Ionicons name="cash-outline" size={20} color={C.primary} />
          <Text style={styles.cashText}>Bayar Tunai</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.cashBtn, { backgroundColor: '#2563EB', marginTop: 10 }]} onPress={() => handleCheckoutInit('qris')} disabled={processing}>
          <Ionicons name="qr-code-outline" size={20} color="#FFF" />
          <Text style={[styles.cashText, { color: '#FFF' }]}>Bayar QRIS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.creditBtn, { marginTop: 10 }]} onPress={() => handleCheckoutInit('salary_cut')} disabled={processing}>
          <Ionicons name="card-outline" size={20} color="#FFF" />
          <Text style={styles.creditText}>Kredit / Potong Gaji</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MEMBER SEARCH MODAL FOR SALARY CUT */}
      <Modal visible={showMemberModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Cari Nama Anggota</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Ketik Nama atau NRP..."
              value={memberSearch}
              onChangeText={searchMembers}
              autoFocus
            />

            {searchingMember ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={C.primary} />
            ) : members.length === 0 && memberSearch.length > 2 ? (
              <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Anggota tidak ditemukan</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => String(item.id)}
                style={{ marginTop: 15, maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalMemberItem}
                    onPress={() => {
                      Alert.alert(
                        'Konfirmasi Anggota',
                        `Potong Gaji atas nama:\n${item.name}\nNRP: ${item.nrp}\nTotal: ${formatRp(total)}`,
                        [
                          { text: 'Batal', style: 'cancel' },
                          { text: 'Setuju & Pilih', onPress: () => performCheckoutAPI('salary_cut', item.id) }
                        ]
                      );
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{item.name}</Text>
                    <Text style={{ color: '#666', fontSize: 13 }}>NRP: {item.nrp}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
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
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: '#FFF',
  },
  searchBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 12 },
  productCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  productName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  productSku: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: C.accent, marginRight: 4 },
  cartFab: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  cartFabText: { flex: 1, color: C.primary, fontSize: 15, fontWeight: 'bold' },
  cartBadge: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  cartBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  cartItem: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cartItemName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  cartItemPrice: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { backgroundColor: C.background, borderRadius: 8, padding: 6 },
  qtyText: { fontSize: 16, fontWeight: 'bold', color: C.foreground, minWidth: 24, textAlign: 'center' },
  cartSubtotal: { fontSize: 14, fontWeight: 'bold', color: C.accent, minWidth: 80, textAlign: 'right' },
  totalCard: {
    backgroundColor: C.primary, borderRadius: 16, padding: 20, marginTop: 12, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { color: C.mutedForeground, fontSize: 14, fontWeight: '600' },
  totalAmount: { color: C.accent, fontSize: 24, fontWeight: 'bold' },
  cashBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12,
  },
  cashText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
  creditBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.secondary, paddingVertical: 16, borderRadius: 12,
  },
  creditText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: 400 },
  modalInput: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, fontSize: 16 },
  modalMemberItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }
});
