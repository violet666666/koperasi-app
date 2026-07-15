import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

const employeeTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    organik_polri: 'Polri',
    pns_polri: 'PNS',
    purnawirawan: 'Purnawirawan',
    masyarakat_umum: 'Masyarakat Umum',
  };
  return map[type] || type;
};

export default function MemberDetailScreen({ route, navigation }: any) {
  const { memberId, memberName } = route?.params || {};
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Piutang Barang State
  const [piutang, setPiutang] = useState<any>(null);
  const [piutangModal, setPiutangModal] = useState(false);
  const [piutangLoading, setPiutangLoading] = useState(false);

  // Transaction History State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txExpanded, setTxExpanded] = useState(false);

  const loadData = async () => {
    if (!memberId) { setLoading(false); return; }
    try {
      const res = await api.get(`/api/mobile/members/${memberId}`);
      setData(res.data.data);
    } catch (err) {
      log.error('Failed to load member detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPiutang = async () => {
    if (!memberId) return;
    setPiutangLoading(true);
    try {
      const res = await api.get(`/api/members/${memberId}/piutang-barang`);
      setPiutang(res.data.data);
    } catch (err) {
      log.error('Failed to load piutang barang:', err);
    } finally {
      setPiutangLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!memberId) return;
    setTxLoading(true);
    try {
      const res = await api.get(`/api/members/${memberId}/transactions`);
      setTransactions(res.data.data?.transactions || []);
    } catch (err) {
      log.error('Failed to load transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      loadData();
      loadPiutang();
      loadTransactions();
    }
  }, [memberId]);

  const openEditModal = () => {
    if (!data) return;
    setEditData({
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      category: data.category || '',
      pangkat: data.pangkat || '',
      golongan: data.golongan || '',
      kesatuan: data.kesatuan || '',
      employeeType: data.employeeType || '',
      salary: data.salary?.toString() || '0',
      tunlesKinerja: data.tunlesKinerja?.toString() || '0',
      plafonPiutang: data.plafonPiutang?.toString() || '0',
    });
    setEditModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {};
      // Only send changed fields
      if (editData.phone !== (data.phone || '')) payload.phone = editData.phone;
      if (editData.email !== (data.email || '')) payload.email = editData.email;
      if (editData.address !== (data.address || '')) payload.address = editData.address;
      if (editData.category !== (data.category || '')) payload.category = editData.category;
      if (editData.pangkat !== (data.pangkat || '')) payload.pangkat = editData.pangkat;
      if (editData.golongan !== (data.golongan || '')) payload.golongan = editData.golongan;
      if (editData.kesatuan !== (data.kesatuan || '')) payload.kesatuan = editData.kesatuan;
      if (editData.employeeType !== (data.employeeType || '')) payload.employeeType = editData.employeeType;
      
      const numSalary = parseInt(editData.salary.replace(/\D/g, ''), 10) || 0;
      const numTunkin = parseInt(editData.tunlesKinerja.replace(/\D/g, ''), 10) || 0;
      const numPlafon = parseInt(editData.plafonPiutang.replace(/\D/g, ''), 10) || 0;
      
      if (numSalary !== data.salary) payload.salary = numSalary;
      if (numTunkin !== data.tunlesKinerja) payload.tunlesKinerja = numTunkin;
      if (numPlafon !== data.plafonPiutang) payload.plafonPiutang = numPlafon;

      if (Object.keys(payload).length === 0) {
        Alert.alert('Info', 'Tidak ada perubahan data');
        setSaving(false);
        return;
      }

      const res = await api.patch(`/api/mobile/members/${memberId}`, payload);
      Alert.alert('Berhasil ✅', res.data.message);
      setEditModal(false);
      setLoading(true);
      loadData();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Detail Anggota</Text>
        {data && (
          <TouchableOpacity onPress={openEditModal} style={{ padding: 4 }}>
            <Ionicons name="create-outline" size={22} color={C.accent} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.emptyText}>Data anggota tidak ditemukan</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color="#FFF" />
            </View>
            <Text style={styles.name}>{data.name || memberName}</Text>
            <Text style={styles.nrp}>NRP: {data.nrp || '-'}</Text>
            {data.category && <Text style={styles.category}>{data.category}</Text>}
          </View>

          {/* Info Section */}
          <Text style={styles.sectionTitle}>Informasi Pribadi</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="id-card-outline" label="No. Anggota" value={data.memberNo || '-'} />
            <InfoRow icon="mail-outline" label="Email" value={data.email || '-'} />
            <InfoRow icon="call-outline" label="Telepon" value={data.phone || '-'} />
            <InfoRow icon="ribbon-outline" label="Kategori" value={data.category || '-'} />
            <InfoRow icon="briefcase-outline" label="Pangkat" value={data.pangkat || '-'} />
            <InfoRow icon="grid-outline" label="Golongan" value={data.golongan || '-'} />
            <InfoRow icon="business-outline" label="Kesatuan" value={data.kesatuan || '-'} />
            <InfoRow icon="people-outline" label="Jenis Pegawai" value={data.employeeType ? employeeTypeLabel(data.employeeType) : '-'} />
            <InfoRow icon="calendar-outline" label="Tgl Bergabung" value={data.joinDate ? new Date(data.joinDate).toLocaleDateString('id-ID') : '-'} last />
          </View>

          {/* Financial Section */}
          <Text style={styles.sectionTitle}>Informasi Keuangan</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="cash-outline" label="Gaji Pokok" value={formatRp(data.salary)} />
            <InfoRow icon="medal-outline" label="Tunkin" value={formatRp(data.tunlesKinerja)} />
            <InfoRow icon="shield-outline" label="Plafon Piutang" value={formatRp(data.plafonPiutang)} />
            <InfoRow icon="wallet-outline" label="Total Simpanan" value={formatRp(data.totalSavings)} />
            <InfoRow icon="card-outline" label="Pinjaman Aktif" value={formatRp(data.totalLoansOutstanding)} last />
          </View>

          {/* Savings Accounts */}
          {(data.savingsAccounts?.length ?? 0) > 0 && (
            <>
              <Text style={styles.sectionTitle}>Rekening Simpanan</Text>
              {(data.savingsAccounts ?? []).map((acc: any) => (
                <View key={acc.id} style={styles.accountRow}>
                  <View>
                    <Text style={styles.accountName}>{acc.product?.name || 'Simpanan'}</Text>
                    <Text style={styles.accountNo}>{acc.accountNo}</Text>
                  </View>
                  <Text style={styles.accountBalance}>{formatRp(acc.balance)}</Text>
                </View>
              ))}
            </>
          )}

          {/* Piutang Barang Card */}
          <Text style={styles.sectionTitle}>Piutang Barang</Text>
          <TouchableOpacity
            style={[styles.infoCard, { padding: 16 }]}
            onPress={() => {
              if (piutang?.piutang?.length > 0) setPiutangModal(true);
            }}
            activeOpacity={piutang?.piutang?.length > 0 ? 0.7 : 1}
          >
            {piutangLoading ? (
              <ActivityIndicator size="small" color={C.accent} />
            ) : piutang?.summary?.totalItems > 0 ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="cart-outline" size={20} color="#D97706" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>Piutang Belum Lunas</Text>
                      <Text style={{ fontSize: 12, color: C.mutedForeground }}>{piutang.summary.totalItems} transaksi</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#DC2626' }}>
                      {formatRp(piutang.summary.totalAmount)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: C.accent }}>Lihat Detail</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.accent} />
                    </View>
                  </View>
                </View>
                {/* Unit type breakdown */}
                {Object.entries(piutang.summary.byUnitType || {}).map(([unit, amount]: [string, any]) => (
                  <View key={unit} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ fontSize: 12, color: C.mutedForeground, textTransform: 'capitalize' }}>{unit.replace('_', ' ')}</Text>
                    <Text style={{ fontSize: 12, color: C.foreground, fontWeight: '500' }}>{formatRp(amount)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color={C.success} />
                <Text style={{ fontSize: 14, color: C.success, fontWeight: '500' }}>Tidak ada piutang barang</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Transaction History (Buku Anggota) */}
          <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
          <TouchableOpacity
            style={[styles.infoCard, { padding: 16 }]}
            onPress={() => setTxExpanded(!txExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>Buku Anggota</Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>
                    {txLoading ? 'Memuat...' : `${transactions.length} transaksi`}
                  </Text>
                </View>
              </View>
              <Ionicons name={txExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={C.mutedForeground} />
            </View>
          </TouchableOpacity>

          {txExpanded && (
            <View style={{ marginTop: 8 }}>
              {txLoading ? (
                <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 16 }} />
              ) : transactions.length === 0 ? (
                <Text style={{ fontSize: 13, color: C.mutedForeground, textAlign: 'center', paddingVertical: 16 }}>
                  Belum ada riwayat transaksi
                </Text>
              ) : (
                <View style={{ backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Header */}
                  <View style={[styles.txHeader, { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12 }]}>
                    <Text style={[styles.txHeaderText, { flex: 1.2 }]}>Tanggal</Text>
                    <Text style={[styles.txHeaderText, { flex: 2.5 }]}>Keterangan</Text>
                    <Text style={[styles.txHeaderText, { flex: 1.2, textAlign: 'right' }]}>Debit</Text>
                    <Text style={[styles.txHeaderText, { flex: 1.2, textAlign: 'right' }]}>Kredit</Text>
                    <Text style={[styles.txHeaderText, { flex: 1.2, textAlign: 'right' }]}>Saldo</Text>
                  </View>
                  {transactions.slice(0, 30).map((tx: any, idx: number) => {
                    const typeColor: Record<string, string> = {
                      simpanan: '#16A34A', penarikan: '#DC2626', pinjaman: '#2563EB', angsuran: '#D97706'
                    };
                    return (
                      <View key={tx.id} style={[styles.txRow, idx % 2 === 0 && { backgroundColor: C.background }]}>
                        <Text style={[styles.txCell, { flex: 1.2, fontSize: 10 }]}>{tx.date}</Text>
                        <View style={{ flex: 2.5 }}>
                          <Text style={[styles.txCell, { fontSize: 11 }]} numberOfLines={1}>{tx.description}</Text>
                          <Text style={[styles.txBadge, { color: typeColor[tx.type] || C.mutedForeground, fontSize: 9 }]}>
                            {tx.type?.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.txCell, { flex: 1.2, textAlign: 'right', color: tx.debit > 0 ? '#DC2626' : C.mutedForeground }]}>
                          {tx.debit > 0 ? formatRp(tx.debit) : '-'}
                        </Text>
                        <Text style={[styles.txCell, { flex: 1.2, textAlign: 'right', color: tx.credit > 0 ? '#16A34A' : C.mutedForeground }]}>
                          {tx.credit > 0 ? formatRp(tx.credit) : '-'}
                        </Text>
                        <Text style={[styles.txCell, { flex: 1.2, textAlign: 'right', fontWeight: '600' }]}>
                          {formatRp(tx.balance)}
                        </Text>
                      </View>
                    );
                  })}
                  {transactions.length > 30 && (
                    <Text style={{ fontSize: 11, color: C.mutedForeground, textAlign: 'center', paddingVertical: 8 }}>
                      Menampilkan 30 dari {transactions.length} transaksi
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Edit Button */}
          <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
            <Ionicons name="create" size={18} color={C.primary} />
            <Text style={{ color: C.primary, fontWeight: 'bold', fontSize: 14 }}>✏️ Edit Data Anggota</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Action Buttons (Sticky Footer) */}
      {!loading && data && (
        <View style={styles.actionFooter}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: C.accent }]}
            onPress={() => navigation.navigate('SavingsTransaction', { memberId: data.id, memberName: data.name })}
          >
            <Ionicons name="card-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Simpanan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: C.success }]}
            onPress={() => navigation.navigate('LoanPayment', { memberId: data.id, memberName: data.name })}
          >
            <Ionicons name="cash-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Angsuran</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ Edit Modal ═══ */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.modalTitle}>✏️ Edit Data Anggota</Text>
                  <TouchableOpacity onPress={() => setEditModal(false)}>
                    <Ionicons name="close" size={24} color={C.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground, marginBottom: 4 }}>{data?.name}</Text>
                <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 16 }}>NRP: {data?.nrp || '-'} · No. {data?.memberNo}</Text>

                {/* ── Informasi Kontak ── */}
                <Text style={styles.editSectionTitle}>📱 Informasi Kontak</Text>
                <EditField label="Telepon" value={editData.phone} onChange={(v: string) => setEditData({ ...editData, phone: v })} keyboardType="phone-pad" icon="call-outline" />
                <EditField label="Email" value={editData.email} onChange={(v: string) => setEditData({ ...editData, email: v })} keyboardType="email-address" icon="mail-outline" />
                <EditField label="Alamat" value={editData.address} onChange={(v: string) => setEditData({ ...editData, address: v })} multiline icon="location-outline" />

                {/* ── Informasi Pekerjaan ── */}
                <Text style={styles.editSectionTitle}>💼 Pekerjaan & Kategori</Text>
                <EditField label="Kategori" value={editData.category} onChange={(v: string) => setEditData({ ...editData, category: v })} icon="ribbon-outline" placeholder="Polri, PNS, Karyawan..." />
                <EditField label="Pangkat" value={editData.pangkat} onChange={(v: string) => setEditData({ ...editData, pangkat: v })} icon="briefcase-outline" placeholder="Contoh: IPTU" />
                <EditField label="Golongan" value={editData.golongan} onChange={(v: string) => setEditData({ ...editData, golongan: v })} icon="grid-outline" placeholder="Contoh: III/b" />
                <EditField label="Kesatuan" value={editData.kesatuan} onChange={(v: string) => setEditData({ ...editData, kesatuan: v })} icon="business-outline" placeholder="Contoh: Sat Reskrim" />

                {/* ── Informasi Keuangan ── */}
                <Text style={styles.editSectionTitle}>💰 Data Keuangan</Text>
                <EditField
                  label="Gaji Pokok (Rp)"
                  value={editData.salary?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(v: string) => setEditData({ ...editData, salary: v.replace(/\D/g, '') })}
                  keyboardType="numeric" icon="cash-outline"
                />
                <EditField
                  label="Tunkin / Tunjangan Kinerja (Rp)"
                  value={editData.tunlesKinerja?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(v: string) => setEditData({ ...editData, tunlesKinerja: v.replace(/\D/g, '') })}
                  keyboardType="numeric" icon="medal-outline"
                />
                <EditField
                  label="Plafon Piutang Unit Usaha (Rp)"
                  value={editData.plafonPiutang?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(v: string) => setEditData({ ...editData, plafonPiutang: v.replace(/\D/g, '') })}
                  keyboardType="numeric" icon="shield-outline"
                />
                <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, color: '#92400E' }}>
                    ℹ️ Plafon Piutang menentukan batas maksimal piutang anggota di unit usaha (toko, dll) untuk metode Potong Gaji.
                  </Text>
                </View>

                {/* ── Buttons ── */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: C.muted, flex: 1 }]}
                    onPress={() => setEditModal(false)}
                  >
                    <Text style={{ color: C.foreground, fontWeight: '600' }}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: C.accent, flex: 2, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={C.primary} size="small" />
                    ) : (
                      <Text style={{ color: C.primary, fontWeight: '700' }}>💾 Simpan Perubahan</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Piutang Barang Modal ═══ */}
      <Modal visible={piutangModal} transparent animationType="slide" onRequestClose={() => setPiutangModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>🛒 Detail Piutang Barang</Text>
              <TouchableOpacity onPress={() => setPiutangModal(false)}>
                <Ionicons name="close" size={24} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: C.primary, marginBottom: 12 }}>
              {data?.name} — NRP: {data?.nrp}
            </Text>

            {/* Summary cards */}
            {piutang?.summary && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#991B1B', fontWeight: '600' }}>TOTAL PIUTANG</Text>
                  <Text style={{ fontSize: 14, color: '#DC2626', fontWeight: 'bold' }}>{formatRp(piutang.summary.totalAmount)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#1E40AF', fontWeight: '600' }}>TRANSAKSI</Text>
                  <Text style={{ fontSize: 14, color: '#2563EB', fontWeight: 'bold' }}>{piutang.summary.totalItems}</Text>
                </View>
              </View>
            )}

            {/* Piutang list */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {piutang?.piutang?.map((item: any, idx: number) => {
                const unitLabel = (item.unitType || 'lainnya').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                return (
                  <View key={item.id} style={{
                    backgroundColor: idx % 2 === 0 ? C.background : C.card,
                    borderRadius: 10, padding: 12, marginBottom: 8,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground }} numberOfLines={2}>
                          {item.description}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>
                          {item.transactionNo}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#DC2626', marginLeft: 8 }}>
                        {formatRp(item.amount)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <View style={{ backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: '#1E40AF', fontWeight: '600' }}>{unitLabel}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: C.mutedForeground }}>
                        {new Date(item.transactionDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                      {item.source === 'store_sale' && item.items?.length > 0 && (
                        <Text style={{ fontSize: 10, color: C.mutedForeground }} numberOfLines={1}>
                          ({item.items.length} item)
                        </Text>
                      )}
                    </View>
                    {/* Show items for store_sale */}
                    {item.source === 'store_sale' && item.items?.length > 0 && (
                      <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: C.accent }}>
                        {item.items.map((si: any, siIdx: number) => (
                          <View key={siIdx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: C.mutedForeground }}>{si.name} x{si.quantity}</Text>
                            <Text style={{ fontSize: 11, color: C.foreground }}>{formatRp(si.subtotal)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: C.primary, marginTop: 12 }]}
              onPress={() => setPiutangModal(false)}
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EditField({ label, value, onChange, keyboardType, icon, placeholder, multiline }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons name={icon} size={14} color={C.mutedForeground} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: C.mutedForeground }}>{label}</Text>
      </View>
      <TextInput
        style={[
          editStyles.input,
          multiline && { minHeight: 60, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType || 'default'}
        placeholder={placeholder || ''}
        placeholderTextColor={C.mutedForeground}
        multiline={multiline}
      />
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: C.background }]}>
      <Ionicons name={icon} size={18} color={C.mutedForeground} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const editStyles = StyleSheet.create({
  input: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.foreground,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: C.mutedForeground },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: 'bold', color: C.primary },
  nrp: { fontSize: 14, color: C.accent, fontWeight: '600', marginTop: 4 },
  category: { fontSize: 12, color: C.mutedForeground, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: C.mutedForeground, marginTop: 20, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  infoLabel: { flex: 1, fontSize: 14, color: C.foreground },
  infoValue: { fontSize: 14, color: C.mutedForeground, fontWeight: '500', maxWidth: '50%', textAlign: 'right' },
  accountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  accountName: { fontSize: 14, fontWeight: '600', color: C.primary },
  accountNo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: 'bold', color: C.success },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, paddingVertical: 14, borderRadius: 12, marginTop: 20,
  },
  actionFooter: {
    padding: 16, backgroundColor: C.card, flexDirection: 'row', gap: 12,
    borderTopWidth: 1, borderTopColor: C.border, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.foreground },
  editSectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 8, marginTop: 8,
  },
  modalBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  txHeader: { backgroundColor: C.primaryLight, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  txHeaderText: { fontSize: 10, fontWeight: '700', color: C.primary },
  txRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'flex-start' },
  txCell: { fontSize: 11, color: C.foreground },
  txBadge: { fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },
});
