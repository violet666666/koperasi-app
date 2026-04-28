import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TextInput, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator, Keyboard
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import { StorageManager } from '../../lib/storage';
import { CameraView, Camera } from 'expo-camera';
import { Image as ExpoImage } from 'expo-image';
import Toast from 'react-native-toast-message';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api, { BASE_URL } from '../../lib/api';
import C from '../../lib/colors';

// ── Types ──────────────────────────────────────────────────────────────────
interface Product { id: number; sku: string; name: string; price: number; stock: number; unit: string; }
interface CartItem { product: Product; quantity: number; }
interface Member { id: number; name: string; nrp: string; category?: string; }
interface ServicePackage { id: number; name: string; label: string; price: number; description?: string; }
interface PiutangInfo {
  totalPlafon: number;
  sudahTerpakai: number;
  sisaLimit: number;
  canTransact: boolean;
  memberName: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const UNIT_TYPES = [
  { id: 'toko', name: 'Toko Sembako' },
  { id: 'resto_cafe', name: 'Resto & Cafe' },
  { id: 'cuci_mobil', name: 'Cuci Mobil & Mtr' },
  { id: 'barbershop', name: 'Barbershop' },
  { id: 'fotocopy', name: 'Fotocopy' },
  { id: 'laundry', name: 'Laundry' },
  { id: 'fitness', name: 'Fitness / Gym' },
  { id: 'playstation', name: 'PlayStation' },
];

// ── Paper Size Config (58mm & 80mm thermal printer) ────────────────────────
const PAPER_SIZES = [
  { id: '58mm', label: '58mm', widthPt: 164, widthPx: 384, fontSize: 11, headerSize: 14, totalSize: 13 },
  { id: '80mm', label: '80mm', widthPt: 227, widthPx: 576, fontSize: 13, headerSize: 18, totalSize: 16 },
] as const;
type PaperSizeId = typeof PAPER_SIZES[number]['id'];

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ── Main Component ─────────────────────────────────────────────────────────
export default function KasirScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;

  const [unitType, setUnitType] = useState('toko');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showCart, setShowCart] = useState(false);
  // Pending checkout method: digunakan agar member modal tahu metode bayar yang dipilih (cash/qris/salary_cut)
  const [pendingCheckoutMethod, setPendingCheckoutMethod] = useState<'cash' | 'qris' | 'salary_cut'>('salary_cut');
  const [isKasirLocked, setIsKasirLocked] = useState(false);

  // Quick Sale State (Kasir Cepat)
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickCustomer, setQuickCustomer] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');

  // ── S1-03: Paket Layanan Dinamis diambil via react-query di bawah

  // ── S1-04: Plat Nomor Kendaraan (cuci mobil) ─────────────────────────
  const [vehiclePlate, setVehiclePlate] = useState('');

  // ── Ukuran Kertas Struk (default 58mm untuk thermal printer) ──────────
  const [paperSize, setPaperSize] = useState<PaperSizeId>('58mm');
  const currentPaper = PAPER_SIZES.find(p => p.id === paperSize) || PAPER_SIZES[0];

  // Member Modal
  const memberModalRef = useRef<BottomSheetModal>(null);
  const snapPointsMember = useMemo(() => ['70%', '90%'], []);
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [searchingMember, setSearchingMember] = useState(false);

  // ── S2-02: Piutang Info ───────────────────────────────────────────────
  const [memberPiutang, setMemberPiutang] = useState<PiutangInfo | null>(null);
  const [loadingPiutang, setLoadingPiutang] = useState(false);

  // QRIS Modal State
  const qrisModalRef = useRef<BottomSheetModal>(null);
  const snapPointsQris = useMemo(() => ['65%'], []);
  const [qrisPreviewKey, setQrisPreviewKey] = useState(Date.now().toString());

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    []
  );

  // Barcode Camera Scanner State (Toko only)
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  // ── S2-04: Debounce ref for member search ─────────────────────────────
  const memberSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flags for mode
  // JALUR 1 (unit-layanan / quick sale): cuci_mobil, barbershop, fotocopy
  // JALUR 2 (toko / product cart): toko, resto_cafe, laundry, fitness, playstation
  const isQuickSale = ['cuci_mobil', 'barbershop', 'fotocopy'].includes(unitType);
  const isTokoUnit = ['toko', 'resto_cafe', 'laundry', 'fitness', 'playstation'].includes(unitType);
  const isCarwash = unitType === 'cuci_mobil';

  // ── S1-03: Fetch paket via React Query ──────────────────────────────────────
  const { data: packagesData = [], isLoading: packagesLoading } = useQuery({
    queryKey: ['packages', unitType],
    queryFn: async () => {
      const res = await api.get(`/api/mobile/unit-packages?unitType=${unitType}`);
      return res.data.data as ServicePackage[];
    },
    enabled: ['cuci_mobil', 'barbershop', 'fotocopy'].includes(unitType),
  });
  const packages = packagesData.length > 0 ? packagesData : ([] as ServicePackage[]);

  // ── S0-01: Fetch products via React Query (JALUR 2: toko, resto, laundry, fitness, playstation)
  const { data: productsData = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', unitType, search],
    queryFn: async () => {
      const res = await api.get(`/api/mobile/toko?search=${search}&unitType=${unitType}`);
      return res.data.data as Product[];
    },
    enabled: ['toko', 'resto_cafe', 'laundry', 'fitness', 'playstation'].includes(unitType),
  });
  const products = productsData.length > 0 ? productsData : ([] as Product[]);

  const loading = packagesLoading || productsLoading;

  useEffect(() => {
    // Auto-detect kasir unit from session
    const u = StorageManager.getFastString('userData');
    if (u) {
      try {
        const user = JSON.parse(u);
        if (user.role?.name === 'kasir' && user.unitType) {
          setUnitType(user.unitType);
          setIsKasirLocked(true);
        }
      } catch (e) {}
    }
  }, []);

  const handleUnitChange = (uId: string) => {
    setUnitType(uId);
    setSearch('');
    setQuickAmount('');
    setQuickDesc('');
    setQuickCustomer('');
    setSelectedPackage('');
    setVehiclePlate('');
  };

  const handlePackageSelect = (pkg: ServicePackage) => {
    setSelectedPackage(pkg.name);
    setQuickDesc(pkg.name);
    setQuickAmount(pkg.price.toString());
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const newCart = [...prev];
        if (newCart[idx].quantity < product.stock) {
          newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + 1 };
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Toast.show({ type: 'error', text1: 'Stok Habis', text2: `Stok ${product.name} tersisa ${product.stock}` });
        }
        return newCart;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Open barcode camera scanner (Toko / Resto only)
  const openScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted');
    if (status === 'granted') {
      setScanned(false);
      setShowScanner(true);
    } else {
      Toast.show({ type: 'error', text1: 'Izin Kamera', text2: 'Diperlukan untuk scan barcode' });
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);
    const found = products.find(
      (p) => p.sku === data || p.sku.replace(/-/g, '') === data.replace(/-/g, '')
    );
    if (found) {
      addToCart(found);
      Toast.show({ type: 'success', text1: 'Ditambahkan', text2: `${found.name} ditambahkan ke keranjang.` });
    } else {
      setSearch(data);
      Toast.show({ type: 'error', text1: 'Tidak Ditemukan', text2: `Kode "${data}" tidak ada di database stok.` });
    }
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

  const total = isQuickSale ? Number(quickAmount) : cart.reduce((s, c) => s + c.product.price * c.quantity, 0);

  // ── S1-04: Build description with vehicle plate ─────────────────────
  const buildQuickDesc = () => {
    if (isCarwash && vehiclePlate.trim()) {
      return `${quickDesc} [PLAT:${vehiclePlate.trim().toUpperCase()}]`;
    }
    return quickDesc;
  };

  // ── API Checkouts ──────────────────────────────────────────────────────
  const performStandardCheckoutAPI = async (method: string, memberId: number | null) => {
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
      memberModalRef.current?.dismiss();
      refetchProducts();

      Toast.show({ type: 'success', text1: 'Checkout Berhasil!', text2: `Toko sukses ${formatRp(printedTotal)}.` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Berhasil', 'Cetak struk transaksi?', [
        { text: 'Tidak', style: 'cancel' },
        { text: 'Cetak Struk', onPress: () => printReceiptStandard(method, printedCart, printedTotal) }
      ]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.message || err.response?.data?.message || 'Terjadi kesalahan checkout' });
    } finally { setProcessing(false); }
  };

  const performQuickCheckoutAPI = async (method: string, memberId: number | null) => {
    if (!quickAmount || Number(quickAmount) <= 0) {
      Toast.show({ type: 'error', text1: 'Nominal Tidak Valid', text2: 'Masukkan nominal transaksi yang benar.' });
      return;
    }
    setProcessing(true);
    try {
      await api.post('/api/mobile/unit-layanan', {
        unitType,
        amount: Number(quickAmount),
        paymentMethod: method,
        memberId,
        description: buildQuickDesc(),  // S1-04: include vehicle plate
        customerName: quickCustomer
      });

      const printedDesc = quickDesc;
      const printedTotal = Number(quickAmount);

      setQuickAmount('');
      setQuickDesc('');
      setQuickCustomer('');
      setSelectedPackage('');
      setVehiclePlate(''); // S1-04: reset plate
      memberModalRef.current?.dismiss();
      setMemberPiutang(null);

      Toast.show({ type: 'success', text1: 'Checkout Berhasil!', text2: `${UNIT_TYPES.find(u => u.id === unitType)?.name} sukses ${formatRp(printedTotal)}` });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Berhasil', 'Cetak struk transaksi?', [
        { text: 'Tidak', style: 'cancel' },
        { text: 'Cetak Struk', onPress: () => printReceiptQuick(method, printedDesc, printedTotal) }
      ]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Gagal', text2: err.message || err.response?.data?.message || 'Terjadi kesalahan checkout' });
    } finally { setProcessing(false); }
  };

  // Buka member modal untuk identifikasi anggota (semua metode bayar)
  const openMemberSelection = (method: 'cash' | 'qris' | 'salary_cut') => {
    setPendingCheckoutMethod(method);
    setMemberPiutang(null);
    setMemberSearch('');
    setMembers([]);
    memberModalRef.current?.present();
  };

  const handleCheckoutInit = (method: 'cash' | 'qris' | 'salary_cut') => {
    if (!isQuickSale && cart.length === 0) return;
    if (isQuickSale && (!quickAmount || Number(quickAmount) <= 0)) {
      Toast.show({ type: 'error', text1: 'Nominal Kosong', text2: 'Masukkan nominal transaksi' });
      return;
    }

    if (method === 'qris') {
      qrisModalRef.current?.present();
      return;
    }

    if (method === 'salary_cut') {
      openMemberSelection('salary_cut');
      return;
    }

    // Cash — tanya dulu apakah pelanggan anggota koperasi
    Alert.alert(
      'Pembayaran Tunai',
      `Total: ${formatRp(total)}\n\nApakah pelanggan adalah anggota koperasi?`,
      [
        { text: 'Bukan Anggota', onPress: () => isQuickSale ? performQuickCheckoutAPI('cash', null) : performStandardCheckoutAPI('cash', null) },
        { text: 'Ya, Pilih Anggota', style: 'default', onPress: () => openMemberSelection('cash') },
      ]
    );
  };

  // ── S2-04: Member search dengan debounce 350ms ─────────────────────
  const searchMembers = (q: string) => {
    setMemberSearch(q);
    if (memberSearchDebounceRef.current) clearTimeout(memberSearchDebounceRef.current);
    if (q.length < 1) {
      setMembers([]);
      return;
    }
    memberSearchDebounceRef.current = setTimeout(async () => {
      setSearchingMember(true);
      try {
        const res = await api.get(`/api/mobile/members?search=${q}&limit=10`);
        setMembers(res.data.data || []);
      } catch (e) {
        console.log('Member search error', e);
      } finally {
        setSearchingMember(false);
      }
    }, 350);
  };

  // ── S2-02: Fetch piutang info saat member dipilih ─────────────────
  const fetchMemberPiutang = async (memberId: number) => {
    setLoadingPiutang(true);
    try {
      const res = await api.get(`/api/mobile/members/${memberId}/piutang`);
      setMemberPiutang(res.data);
    } catch (e) {
      console.log('Piutang fetch error', e);
      setMemberPiutang(null);
    } finally {
      setLoadingPiutang(false);
    }
  };

  // ── Receipt Printing (Thermal 58mm / 80mm) ─────────────────────────
  const getHtmlHeader = (method: string) => {
    const p = currentPaper;
    return `
    <html>
      <head>
        <meta name="viewport" content="width=${p.widthPx}, initial-scale=1.0" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: ${p.fontSize}px;
            width: ${p.widthPx}px;
            max-width: ${p.widthPx}px;
            padding: 6px;
            text-align: center;
            color: #000;
          }
          .header { font-size: ${p.headerSize}px; font-weight: bold; margin-bottom: 3px; line-height: 1.3; }
          .sub { font-size: ${p.fontSize - 1}px; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 6px; line-height: 1.4; }
          .item-row { display: flex; justify-content: space-between; text-align: left; margin-bottom: 3px; font-size: ${p.fontSize}px; line-height: 1.3; }
          .item-name { max-width: 65%; word-wrap: break-word; }
          .item-price { text-align: right; font-weight: bold; }
          .total-section { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: ${p.totalSize}px; }
          .footer { margin-top: 10px; font-size: ${p.fontSize - 2}px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="header">PRIMKOPPOL LUMAJANG<br/>${UNIT_TYPES.find(u => u.id === unitType)?.name.toUpperCase() || "UNIT USAHA"}</div>
        <div class="sub">
          Tgl: ${new Date().toLocaleString('id-ID')}<br/>
          Metode: ${method.toUpperCase()}<br/>
          Kasir: Mobile POS
        </div>
  `;
  };
  const getHtmlFooter = () => `
        <div class="footer">
          Terima Kasih Atas Kunjungan Anda<br/>
          Barang yang sudah dibeli tidak dapat ditukar
        </div>
      </body>
    </html>
  `;

  const printReceiptStandard = async (method: string, items: CartItem[], amount: number) => {
    try {
      const html = getHtmlHeader(method) + items.map(c => `
        <div class="item-row">
          <div class="item-name">${c.product.name}<br/>${c.quantity} x ${c.product.price.toLocaleString('id-ID')}</div>
          <div class="item-price">${(c.quantity * c.product.price).toLocaleString('id-ID')}</div>
        </div>
      `).join('') + `
        <div class="total-section">
          <span>TOTAL</span>
          <span>Rp ${amount.toLocaleString('id-ID')}</span>
        </div>
      ` + getHtmlFooter();
      await Print.printAsync({ html, width: currentPaper.widthPt });
    } catch (err) { console.log('Print error:', err); }
  };

  const printReceiptQuick = async (method: string, desc: string, amount: number) => {
    try {
      const html = getHtmlHeader(method) + `
        <div class="item-row">
          <div class="item-name">Jasa Layanan<br/>${desc || 'Walk-in'}</div>
          <div class="item-price">${amount.toLocaleString('id-ID')}</div>
        </div>
        ${vehiclePlate ? `<div class="item-row"><div class="item-name">Plat: ${vehiclePlate}</div></div>` : ''}
        <div class="total-section">
          <span>TOTAL</span>
          <span>Rp ${amount.toLocaleString('id-ID')}</span>
        </div>
      ` + getHtmlFooter();
      await Print.printAsync({ html, width: currentPaper.widthPt });
    } catch (err) { console.log('Print error:', err); }
  };

  // ── RENDER UI ──────────────────────────────────────────────────────────

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
            <Text style={styles.headerTitle}>🛒 Kasir POS</Text>
          </View>

          {/* Unit Type Chips */}
          {!isKasirLocked && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexDirection: 'row' }}>
              {UNIT_TYPES.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={{ backgroundColor: unitType === u.id ? C.accent : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginRight: 8 }}
                  onPress={() => handleUnitChange(u.id)}
                >
                  <Text style={{ color: unitType === u.id ? C.primary : '#FFF', fontWeight: unitType === u.id ? 'bold' : 'normal', fontSize: 13 }}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {isKasirLocked && (
            <View style={{ marginBottom: 16, flexDirection: 'row' }}>
              <View style={{ backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 }}>
                <Text style={{ color: C.primary, fontWeight: 'bold', fontSize: 13 }}>
                  🛒 {UNIT_TYPES.find(u => u.id === unitType)?.name || unitType.toUpperCase()}
                </Text>
              </View>
            </View>
          )}

          {!isQuickSale && (
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari produk atau ketik SKU..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => refetchProducts()}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={() => refetchProducts()}>
                <Ionicons name="search" size={20} color={C.primary} />
              </TouchableOpacity>
              {isTokoUnit && (
                <TouchableOpacity
                  style={[styles.searchBtn, { backgroundColor: C.primary, marginLeft: 4 }]}
                  onPress={openScanner}
                >
                  <Ionicons name="barcode-outline" size={20} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {isQuickSale ? (
          // ── KASIR CEPAT (Carwash / Barbershop) ────────────────────────────
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

            {/* S1-03: Paket dari DB — skeleton loading */}
            {packagesLoading ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: C.foreground }}>Pilih Paket Layanan:</Text>
                {[1, 2, 3].map(i => (
                  <View key={i} style={[styles.packageCard, { backgroundColor: '#F1F5F9' }]}>
                    <View style={{ width: 120, height: 16, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                    <View style={{ width: 60, height: 16, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                  </View>
                ))}
              </View>
            ) : packages.length > 0 ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: C.foreground }}>Pilih Paket Layanan:</Text>
                {packages.map(pkg => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.packageCard, selectedPackage === pkg.name && styles.packageCardSelected]}
                    onPress={() => handlePackageSelect(pkg)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.packageName, selectedPackage === pkg.name && { color: C.primary }]}>{pkg.name}</Text>
                      {pkg.description ? (
                        <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>{pkg.description}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.packagePrice, selectedPackage === pkg.name && { color: C.primary }]}>{formatRp(pkg.price)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 12, elevation: 1 }}>
              <Text style={styles.label}>Nominal Transaksi (Rp)</Text>
              <TextInput
                style={styles.inputBold}
                keyboardType="numeric"
                placeholder="0"
                value={quickAmount}
                onChangeText={setQuickAmount}
              />

              <Text style={styles.label}>Keterangan / Jasa (Opsional)</Text>
              <TextInput
                style={styles.inputForm}
                placeholder="Contoh: Paket VIP salju"
                value={quickDesc}
                onChangeText={setQuickDesc}
              />

              {/* S1-04: Input plat nomor — hanya tampil untuk cuci_mobil */}
              {isCarwash && (
                <>
                  <Text style={styles.label}>🚗 Plat Nomor Kendaraan <Text style={{ color: C.destructive }}>*</Text></Text>
                  <TextInput
                    style={[styles.inputForm, { textTransform: 'uppercase', letterSpacing: 2 }]}
                    placeholder="Cth: B 1234 ABC"
                    value={vehiclePlate}
                    onChangeText={(val) => setVehiclePlate(val.toUpperCase().slice(0, 12))}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                </>
              )}

              <Text style={styles.label}>Nama Pelanggan Walk-In (Opsional)</Text>
              <TextInput
                style={styles.inputForm}
                placeholder="Isi nama jika diperlukan"
                value={quickCustomer}
                onChangeText={setQuickCustomer}
              />
            </View>

            <View style={{ marginTop: 20 }}>
              {/* Paper Size Toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 6 }}>
                <Ionicons name="print-outline" size={16} color={C.mutedForeground} />
                <Text style={{ fontSize: 12, color: C.mutedForeground, marginRight: 4 }}>Ukuran Struk:</Text>
                {PAPER_SIZES.map(ps => (
                  <TouchableOpacity
                    key={ps.id}
                    onPress={() => setPaperSize(ps.id)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: paperSize === ps.id ? C.primary : '#F1F5F9',
                      borderWidth: 1, borderColor: paperSize === ps.id ? C.primary : '#E2E8F0',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: paperSize === ps.id ? '#FFF' : C.mutedForeground }}>
                      {ps.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.cashBtn} onPress={() => handleCheckoutInit('cash')} disabled={processing || !quickAmount}>
                <Ionicons name="cash-outline" size={20} color={C.primary} />
                <Text style={styles.cashText}>Bayar Tunai</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cashBtn, { backgroundColor: '#2563EB', marginTop: 10 }]} onPress={() => handleCheckoutInit('qris')} disabled={processing || !quickAmount}>
                <Ionicons name="qr-code-outline" size={20} color="#FFF" />
                <Text style={[styles.cashText, { color: '#FFF' }]}>Bayar QRIS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.creditBtn, { marginTop: 10 }]} onPress={() => handleCheckoutInit('salary_cut')} disabled={processing || !quickAmount}>
                <Ionicons name="card-outline" size={20} color="#FFF" />
                <Text style={styles.creditText}>Kredit / Potong Gaji</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          // ── KASIR NORMAL (Toko, Resto) ─────────────────────────────────────
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
            refreshControl={<RefreshControl refreshing={productsLoading} onRefresh={() => refetchProducts()} colors={[C.accent]} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{loading ? '⏳' : '📦'}</Text>
                <Text style={styles.emptyText}>{loading ? 'Memuat produk...' : 'Produk tidak ditemukan di unit ini'}</Text>
              </View>
            }
          />
        )}

        {/* Floating Cart Button for Normal Kasir */}
        {!isQuickSale && cart.length > 0 && (
          <TouchableOpacity style={styles.cartFab} onPress={() => setShowCart(true)}>
            <Ionicons name="cart" size={24} color={C.primary} />
            <Text style={styles.cartFabText}>{cart.length} item • {formatRp(total)}</Text>
            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.reduce((s, c) => s + c.quantity, 0)}</Text></View>
          </TouchableOpacity>
        )}

        {renderMemberModal()}
        {renderQrisModal()}
      </View>
    );
  }

  // ── KERANJANG VIEW (Untuk Kasir Normal) ─────────────────────────────────
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

        {/* Paper Size Toggle (Toko/Resto) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 6 }}>
          <Ionicons name="print-outline" size={16} color={C.mutedForeground} />
          <Text style={{ fontSize: 12, color: C.mutedForeground, marginRight: 4 }}>Ukuran Struk:</Text>
          {PAPER_SIZES.map(ps => (
            <TouchableOpacity
              key={ps.id}
              onPress={() => setPaperSize(ps.id)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: paperSize === ps.id ? C.primary : '#F1F5F9',
                borderWidth: 1, borderColor: paperSize === ps.id ? C.primary : '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: paperSize === ps.id ? '#FFF' : C.mutedForeground }}>
                {ps.label}
              </Text>
            </TouchableOpacity>
          ))}
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

      {renderMemberModal()}
      {renderQrisModal()}
    </View>
  );

  // ── QRIS Modal ───────────────────────────────────────────────────────────
  function renderQrisModal() {
    return (
      <BottomSheetModal
        ref={qrisModalRef}
        snapPoints={snapPointsQris}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: C.accent }}>Pindai QRIS Unit</Text>
            <TouchableOpacity onPress={() => qrisModalRef.current?.dismiss()}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#F0F9FF', padding: 20, borderRadius: 16, alignItems: 'center', width: '100%', borderWidth: 2, borderColor: '#BAE6FD', borderStyle: 'dashed' }}>
            <Text style={{ fontSize: 12, color: '#0369A1', marginBottom: 10, textAlign: 'center' }}>
              Arahkan layar ini ke pelanggan untuk melakukan Scan Kode QR.
            </Text>
            <View style={{ backgroundColor: '#FFF', padding: 10, borderRadius: 12, elevation: 4 }}>
              <ExpoImage
                source={{ uri: `${BASE_URL}/uploads/qris/qris-${unitType}.png` }}
                style={{ width: 200, height: 200 }}
                contentFit="contain"
                transition={200}
                cachePolicy="disk"
                placeholder={{ blurhash: 'L4M?1Q~q000000M{000000M{%Mof' }} // Optional standard blurhash
              />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0369A1', marginTop: 15 }}>
              {formatRp(total)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.cashBtn, { backgroundColor: '#2563EB', width: '100%', marginTop: 20 }]}
            onPress={() => {
              qrisModalRef.current?.dismiss();
              // Tanya apakah pelanggan anggota koperasi
              Alert.alert(
                'QRIS Berhasil',
                'Apakah pelanggan adalah anggota koperasi?',
                [
                  { text: 'Bukan Anggota', onPress: () => isQuickSale ? performQuickCheckoutAPI('qris', null) : performStandardCheckoutAPI('qris', null) },
                  { text: 'Ya, Pilih Anggota', style: 'default', onPress: () => openMemberSelection('qris') },
                ]
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={[styles.cashText, { color: '#FFF' }]}>Pelanggan Sudah Membayar</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }

  // ── Member Modal (Semua Metode Bayar - Identifikasi Anggota) ─────────────
  function renderMemberModal() {
    const isSalaryCut = pendingCheckoutMethod === 'salary_cut';
    // S2-02: Cek piutang hanya untuk potong gaji
    const canProceed = !isSalaryCut || !memberPiutang || memberPiutang.canTransact && total <= memberPiutang.sisaLimit;
    const limitTooLow = isSalaryCut && memberPiutang && total > memberPiutang.sisaLimit;

    return (
      <>
        <BottomSheetModal ref={memberModalRef} snapPoints={snapPointsMember} backdropComponent={renderBackdrop} keyboardBehavior="extend">
          <View style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{isSalaryCut ? 'Kredit / Potong Gaji' : 'Pilih Anggota'}</Text>
                <TouchableOpacity onPress={() => { memberModalRef.current?.dismiss(); setMemberPiutang(null); }}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* S2-02: Info piutang saat member dipilih */}
              {memberPiutang && !loadingPiutang && (
                <View style={{
                  backgroundColor: limitTooLow ? '#FEF2F2' : '#F0FDF4',
                  borderRadius: 10, padding: 12, marginBottom: 12,
                  borderWidth: 1, borderColor: limitTooLow ? '#FECACA' : '#BBF7D0'
                }}>
                  <Text style={{ fontWeight: 'bold', color: limitTooLow ? '#DC2626' : '#15803D', marginBottom: 4 }}>
                    {limitTooLow ? '⛔ Limit Tidak Mencukupi' : '✅ Limit Tersedia'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Plafon Total: {formatRp(memberPiutang.totalPlafon)}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Terpakai: {formatRp(memberPiutang.sudahTerpakai)}</Text>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: limitTooLow ? '#DC2626' : '#15803D' }}>
                    Sisa Limit: {formatRp(memberPiutang.sisaLimit)}
                  </Text>
                  {limitTooLow && (
                    <Text style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                      Transaksi {formatRp(total)} melebihi sisa limit anggota.
                    </Text>
                  )}
                </View>
              )}
              {loadingPiutang && (
                <View style={{ padding: 8, marginBottom: 12 }}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 12, marginTop: 4 }}>Memuat info limit...</Text>
                </View>
              )}

              {/* S2-04: Search input */}
              <BottomSheetTextInput
                style={styles.modalInput}
                placeholder="Ketik Nama atau NRP..."
                value={memberSearch}
                onChangeText={searchMembers}
                autoFocus
              />

              {searchingMember ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={C.primary} />
              ) : members.length === 0 && memberSearch.length > 1 ? (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Anggota tidak ditemukan</Text>
              ) : (
                <BottomSheetFlatList
                  data={members}
                  keyExtractor={(item: Member) => String(item.id)}
                  style={{ marginTop: 15 }}
                  renderItem={({ item }: { item: Member }) => (
                    <TouchableOpacity
                      style={styles.modalMemberItem}
                      onPress={async () => {
                        if (isSalaryCut) {
                          // S2-02: Fetch piutang info sebelum konfirmasi
                          await fetchMemberPiutang(item.id);
                        } else {
                          // Cash/QRIS: langsung proses dengan memberId
                          memberModalRef.current?.dismiss();
                          if (isQuickSale) {
                            performQuickCheckoutAPI(pendingCheckoutMethod, item.id);
                          } else {
                            performStandardCheckoutAPI(pendingCheckoutMethod, item.id);
                          }
                        }
                      }}
                    >
                      {/* S2-04: Avatar inisial */}
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{item.name}</Text>
                          {item.category && (
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>{item.category}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: '#666', fontSize: 13 }}>NRP: {item.nrp}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}

              {/* Tombol konfirmasi — muncul setelah member di-tap dan piutang di-fetch */}
              {/* Tombol konfirmasi hanya untuk mode Potong Gaji (perlu validasi piutang) */}
              {isSalaryCut && memberPiutang && !loadingPiutang && (
                <TouchableOpacity
                  style={[styles.cashBtn, { marginTop: 16, opacity: limitTooLow ? 0.4 : 1 }]}
                  disabled={!!limitTooLow || processing}
                  onPress={() => {
                    const selectedMember = members.find(m => m.name === memberPiutang.memberName);
                    if (!selectedMember) return;
                    Alert.alert(
                      'Konfirmasi Anggota',
                      `Potong Gaji atas nama:\n${memberPiutang.memberName}\nTotal: ${formatRp(total)}\nSisa Limit: ${formatRp(memberPiutang.sisaLimit)}`,
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Setuju & Proses', onPress: () => isQuickSale ? performQuickCheckoutAPI('salary_cut', selectedMember.id) : performStandardCheckoutAPI('salary_cut', selectedMember.id) }
                      ]
                    );
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                  <Text style={styles.cashText}>
                    {limitTooLow ? 'Limit Tidak Cukup' : `Setuju & Potong Gaji`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
        </BottomSheetModal>

        {/* Barcode Camera Scanner Modal */}
        <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'] }}
            />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
              <View style={{ width: 240, height: 160, borderWidth: 2, borderColor: '#34D399', borderRadius: 12 }} />
              <Text style={{ color: '#FFF', marginTop: 16, fontSize: 14, textAlign: 'center' }}>
                Arahkan kamera ke barcode produk
              </Text>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', top: 48, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 10 }}
              onPress={() => setShowScanner(false)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            {scanned && (
              <TouchableOpacity
                style={{ position: 'absolute', bottom: 40, left: 40, right: 40, backgroundColor: '#34D399', borderRadius: 12, padding: 16, alignItems: 'center' }}
                onPress={() => { setScanned(false); }}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Scan Lagi</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>
      </>
    );
  }
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
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, maxHeight: '90%' },
  modalInput: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  modalMemberItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 12 },
  // S2-04: Avatar & badge styles
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  categoryBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  categoryBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  // Kasir Cepat Styles
  label: { fontSize: 13, color: '#64748B', marginBottom: 6, marginTop: 12, fontWeight: '600' },
  inputBold: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 12, fontSize: 20, fontWeight: 'bold' },
  inputForm: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 12, fontSize: 14 },
  packageCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 8 },
  packageCardSelected: { borderColor: C.primary, backgroundColor: C.primaryLight + '15' },
  packageName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  packagePrice: { fontSize: 14, fontWeight: 'bold', color: C.accent },
});
