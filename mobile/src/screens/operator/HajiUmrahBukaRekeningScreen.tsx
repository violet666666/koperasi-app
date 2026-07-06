import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { StorageManager } from '../../lib/storage';
import { log } from '../../utils/log';

/**
 * HajiUmrahBukaRekeningScreen (Fase 9a.1 T7)
 *
 * Open-account form for Haji & Umrah savings.
 *
 * FIELD CONTRACT (Fase 6 lesson — do NOT guess; read the routes):
 *
 * Products — GET /api/mobile/haji-umrah/products → { data: SavingsProduct[] }
 *   SavingsProduct fields used: id, code, name, type ('tabungan_haji'|
 *   'tabungan_umrah'), targetAmount, minimumAmount, adminFeeType,
 *   adminFeeValue, linkedBankName, isActive. Picker shows name + type badge;
 *   targetAmount defaults the form's target field.
 *
 * Members — GET /api/mobile/members?search=xxx → { data: Member[] }
 *   Member fields: id, memberNo, name, nrp, status, totalSavings,
 *   totalLoanOutstanding. Picker shows name + NRP (reuses EXISTING endpoint —
 *   no new route invented).
 *
 * Submit — POST /api/mobile/haji-umrah/savings/open
 *   Body: { memberId: number, productId: number, targetAmount?: number,
 *           monthlyTarget?: number, maturityDate?: 'YYYY-MM-DD' }
 *   → 201 { data: <SavingsAccount> } (account.accountNo is shown on success)
 *   → 409 { message } surfaced verbatim (duplicate-active-account).
 *
 * canManage (defensive — the screen is reached only via the gated FAB on the
 * list screen, but the gate is re-checked here and the API enforces it too):
 * operator always; admin only if unitType === 'haji_umrah'.
 *
 * log.* only (zero raw console.*) — Play Store policy.
 */

// ---- Route response shapes (only fields the form reads) ----
type SavingsProduct = {
  id: number;
  code: string;
  name: string;
  type: string; // 'tabungan_haji' | 'tabungan_umrah'
  targetAmount: number | string | null;
  minimumAmount: number | string | null;
  adminFeeType: string | null;
  adminFeeValue: number | string | null;
  linkedBankName: string | null;
  isActive: boolean;
};

type Member = {
  id: number;
  memberNo: string;
  name: string;
  nrp: string;
  status: string;
};

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

/** Validate YYYY-MM-DD (same check as HajiUmrahSetoranScreen). */
function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00').getTime());
}

export default function HajiUmrahBukaRekeningScreen({ navigation }: any) {
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Member search + picker state
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Product picker
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Form fields
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---- canManage gate (defensive — mirrors list + detail + API write gate) ----
  const canManage = useMemo(() => {
    const ud = StorageManager.getFastString('userData');
    if (!ud) return false;
    try {
      const p = JSON.parse(ud);
      return p.role === 'operator' || (p.role === 'admin' && p.unitType === 'haji_umrah');
    } catch { return false; }
  }, []);

  // ---- Load products once (H&U types only — route already filters) ----
  const loadProducts = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/haji-umrah/products');
      setProducts(res.data?.data ?? []);
    } catch (err) {
      log.error('BukaRekening: failed to load products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ---- Debounced member search (reuse existing /api/mobile/members) ----
  useEffect(() => {
    if (!memberSearch.trim()) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get('/api/mobile/members', {
          params: { search: memberSearch.trim(), limit: 20 },
        });
        setMembers(res.data?.data ?? []);
      } catch (err) {
        log.warn('BukaRekening: member search failed:', err);
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [memberSearch]);

  // ---- When a product is selected, default the target field from product.targetAmount ----
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const selectedMember = members.find((m) => m.id === selectedMemberId) || null;

  const onSelectProduct = (p: SavingsProduct) => {
    setSelectedProductId(p.id);
    setProductPickerOpen(false);
    // Default targetAmount from product only if the user hasn't typed one yet.
    if (!targetAmount) {
      const def = Number(p.targetAmount);
      if (def > 0) setTargetAmount(String(def));
    }
  };

  // ---- Numeric parsed form values ----
  const numericTarget = Number(targetAmount.replace(/[^\d]/g, ''));
  const numericMonthly = Number(monthlyTarget.replace(/[^\d]/g, ''));

  const dateValid = !maturityDate || isValidISODate(maturityDate);

  const canSubmit =
    canManage &&
    !submitting &&
    selectedMemberId != null &&
    selectedProductId != null &&
    dateValid;

  const onSubmit = () => {
    if (!canManage) {
      Alert.alert('Akses Ditolak', 'Anda tidak memiliki izin membuka rekening Haji & Umrah.');
      return;
    }
    if (selectedMemberId == null) {
      Alert.alert('Validasi', 'Pilih anggota terlebih dahulu.');
      return;
    }
    if (selectedProductId == null) {
      Alert.alert('Validasi', 'Pilih produk tabungan.');
      return;
    }
    if (maturityDate && !isValidISODate(maturityDate)) {
      Alert.alert('Validasi', 'Tanggal jatuh tempo tidak valid (format YYYY-MM-DD).');
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      // Body — omit optional fields when empty so the helper applies its defaults.
      const body: Record<string, unknown> = {
        memberId: selectedMemberId,
        productId: selectedProductId,
      };
      if (numericTarget > 0) body.targetAmount = numericTarget;
      if (numericMonthly > 0) body.monthlyTarget = numericMonthly;
      if (maturityDate.trim()) body.maturityDate = maturityDate.trim();

      const res = await api.post('/api/mobile/haji-umrah/savings/open', body);
      const accountNo: string = res.data?.data?.accountNo ?? '(tanpa nomor)';

      Alert.alert('Berhasil', `Rekening ${accountNo} dibuka`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      // Surface 409 duplicate / 400 validation messages verbatim from the helper.
      const msg = err?.response?.data?.message || err?.message || 'Gagal membuka rekening.';
      log.error('BukaRekening submit failed:', err);
      Alert.alert('Gagal', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render helpers ----
  const productBadge = (type: string) =>
    type === 'tabungan_haji'
      ? { label: 'Haji', bg: '#16A34A', icon: '🛕' as const }
      : { label: 'Umrah', bg: '#0EA5E9', icon: '🕌' as const };

  const renderMemberOption = (m: Member) => {
    const selected = m.id === selectedMemberId;
    return (
      <TouchableOpacity
        key={m.id}
        style={[styles.optionRow, selected && styles.optionRowActive]}
        onPress={() => {
          setSelectedMemberId(m.id);
          setMemberPickerOpen(false);
          setMemberSearch(''); // clear search box once a member is chosen
        }}
      >
        <Ionicons name="person-outline" size={20} color={selected ? C.accent : C.mutedForeground} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.optionName} numberOfLines={1}>{m.name}</Text>
          <Text style={styles.optionSub} numberOfLines={1}>
            {m.nrp || m.memberNo || '-'}
          </Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={C.accent} /> : null}
      </TouchableOpacity>
    );
  };

  const renderProductOption = (p: SavingsProduct) => {
    const selected = p.id === selectedProductId;
    const badge = productBadge(p.type);
    return (
      <TouchableOpacity
        key={p.id}
        style={[styles.optionRow, selected && styles.optionRowActive]}
        onPress={() => onSelectProduct(p)}
      >
        <View style={[styles.prodBadge, { backgroundColor: badge.bg }]}>
          <Text style={styles.prodBadgeText}>{badge.icon} {badge.label}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.optionName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.optionSub} numberOfLines={1}>
            {p.code}
            {p.targetAmount ? `  •  Target ${formatRp(Number(p.targetAmount))}` : ''}
          </Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={C.accent} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Buka Rekening Haji / Umrah</Text>
          <Text style={styles.headerSub}>Tambah rekening tabungan baru</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== Member picker ===== */}
        <Text style={styles.label}>Anggota *</Text>
        {selectedMember ? (
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setSelectedMemberId(null); setMemberPickerOpen(true); }}
          >
            <Ionicons name="person" size={20} color={C.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.pickerName} numberOfLines={1}>{selectedMember.name}</Text>
              <Text style={styles.pickerSub} numberOfLines={1}>
                {selectedMember.nrp || selectedMember.memberNo || '-'}
              </Text>
            </View>
            <Ionicons name="swap-horizontal" size={18} color={C.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={C.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama / NRP..."
                placeholderTextColor={C.mutedForeground}
                value={memberSearch}
                onChangeText={setMemberSearch}
                onFocus={() => setMemberPickerOpen(true)}
                returnKeyType="search"
              />
              {memberSearch ? (
                <TouchableOpacity
                  onPress={() => { setMemberSearch(''); setMembers([]); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>

            {memberPickerOpen && memberSearch.trim() ? (
              <View style={styles.pickerList}>
                {membersLoading ? (
                  <View style={styles.pickerLoading}>
                    <ActivityIndicator color={C.accent} size="small" />
                  </View>
                ) : members.length === 0 ? (
                  <Text style={styles.pickerEmpty}>
                    Tidak ada anggota ditemukan. Coba kata kunci lain.
                  </Text>
                ) : (
                  members.map(renderMemberOption)
                )}
              </View>
            ) : null}
          </>
        )}

        {/* ===== Product picker ===== */}
        <Text style={styles.label}>Produk Tabungan *</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setProductPickerOpen((v) => !v)}
        >
          {selectedProduct ? (
            <View style={[styles.prodBadge, { backgroundColor: productBadge(selectedProduct.type).bg }]}>
              <Text style={styles.prodBadgeText}>
                {productBadge(selectedProduct.type).icon} {productBadge(selectedProduct.type).label}
              </Text>
            </View>
          ) : (
            <Ionicons name="cube-outline" size={20} color={C.primary} />
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            {selectedProduct ? (
              <>
                <Text style={styles.pickerName} numberOfLines={1}>{selectedProduct.name}</Text>
                <Text style={styles.pickerSub} numberOfLines={1}>
                  {selectedProduct.code}
                  {selectedProduct.targetAmount
                    ? `  •  Target ${formatRp(Number(selectedProduct.targetAmount))}`
                    : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.pickerPlaceholder}>
                {productsLoading ? 'Memuat produk...' : 'Pilih produk'}
              </Text>
            )}
          </View>
          <Ionicons
            name={productPickerOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={C.mutedForeground}
          />
        </TouchableOpacity>

        {productPickerOpen ? (
          <View style={styles.pickerList}>
            {productsLoading ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator color={C.accent} size="small" />
              </View>
            ) : products.length === 0 ? (
              <Text style={styles.pickerEmpty}>
                Tidak ada produk Haji/Umrah aktif. Aktifkan produk di web admin.
              </Text>
            ) : (
              products.map(renderProductOption)
            )}
          </View>
        ) : null}

        {/* ===== Target amount ===== */}
        <Text style={styles.label}>Target Tabungan</Text>
        <View style={styles.amountInput}>
          <Text style={styles.currencyPrefix}>Rp</Text>
          <TextInput
            style={styles.amountField}
            placeholder="0"
            placeholderTextColor={C.mutedForeground}
            keyboardType="numeric"
            value={targetAmount ? Number(numericTarget).toLocaleString('id-ID') : ''}
            onChangeText={(t) => setTargetAmount(t.replace(/[^\d]/g, ''))}
          />
        </View>
        {numericTarget > 0 ? (
          <Text style={styles.helperText}>{formatRp(numericTarget)}</Text>
        ) : null}
        {selectedProduct && Number(selectedProduct.targetAmount) > 0 && numericTarget === 0 ? (
          <Text style={styles.helperText}>
            Default produk: {formatRp(Number(selectedProduct.targetAmount))}
          </Text>
        ) : null}

        {/* ===== Monthly target ===== */}
        <Text style={styles.label}>Target Bulanan (Opsional)</Text>
        <View style={styles.amountInput}>
          <Text style={styles.currencyPrefix}>Rp</Text>
          <TextInput
            style={styles.amountField}
            placeholder="0"
            placeholderTextColor={C.mutedForeground}
            keyboardType="numeric"
            value={monthlyTarget ? Number(numericMonthly).toLocaleString('id-ID') : ''}
            onChangeText={(t) => setMonthlyTarget(t.replace(/[^\d]/g, ''))}
          />
        </View>
        {numericMonthly > 0 ? (
          <Text style={styles.helperText}>{formatRp(numericMonthly)} / bulan</Text>
        ) : null}

        {/* ===== Maturity date ===== */}
        <Text style={styles.label}>Tanggal Jatuh Tempo (Opsional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.mutedForeground}
          value={maturityDate}
          onChangeText={setMaturityDate}
          maxLength={10}
        />
        {!dateValid ? (
          <Text style={styles.errorText}>Format tanggal harus YYYY-MM-DD.</Text>
        ) : null}

        {/* ===== Submit ===== */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Buka Rekening</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.8, marginTop: 2 },

  label: { fontSize: 13, fontWeight: 'bold', color: C.primary, marginBottom: 8, marginLeft: 2, marginTop: 16 },

  // Member search box
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.muted, paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14, color: C.foreground,
  },

  // Generic picker button (product / selected member)
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.muted, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  pickerSub: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  pickerPlaceholder: { fontSize: 14, color: C.mutedForeground },

  pickerList: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.muted,
    marginTop: 8, padding: 6, overflow: 'hidden',
  },
  pickerLoading: { paddingVertical: 16, alignItems: 'center' },
  pickerEmpty: { fontSize: 12, color: C.mutedForeground, padding: 12, textAlign: 'center' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  optionRowActive: { backgroundColor: C.accentBg },
  optionName: { fontSize: 13, fontWeight: '600', color: C.foreground },
  optionSub: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },

  // Product badge (reuses list screen palette)
  prodBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  prodBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Amount inputs
  amountInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.muted, paddingHorizontal: 14,
  },
  currencyPrefix: { fontSize: 18, fontWeight: 'bold', color: C.mutedForeground, marginRight: 8 },
  amountField: { flex: 1, paddingVertical: 14, fontSize: 18, fontWeight: 'bold', color: C.foreground },
  helperText: { fontSize: 11, color: C.mutedForeground, marginTop: 4, marginLeft: 2 },

  // Text inputs (date)
  textInput: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.muted,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.foreground,
  },
  errorText: { fontSize: 11, color: C.destructive, marginTop: 4, marginLeft: 2 },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 15, borderRadius: 12, marginTop: 28,
  },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 6 },
});
