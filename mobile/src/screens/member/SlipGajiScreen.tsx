import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { log } from '../../utils/log';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function SlipGajiScreen({ route, navigation }: any) {
  const { slipId, periodId } = route?.params || {};
  const [slip, setSlip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slipId || !periodId) return;
    api.get(`/api/mobile/payroll/${periodId}/slip/${slipId}`)
      .then(res => setSlip(res.data.data))
      .catch(err => log.error('Failed to load slip:', err))
      .finally(() => setLoading(false));
  }, [slipId, periodId]);

  const handlePrint = async () => {
    if (!slip) return;
    const html = generateSlipHTML(slip);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Slip Gaji' });
      } else {
        Alert.alert('Berhasil', 'File PDF tersimpan');
      }
    } catch (err) {
      Alert.alert('Gagal', 'Tidak bisa mencetak slip');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (!slip) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
        <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Slip tidak ditemukan</Text>
      </View>
    );
  }

  let otherDeductions: Record<string, number> | null = null;
  try {
    otherDeductions = typeof slip.otherDeductions === 'string' ? JSON.parse(slip.otherDeductions) : slip.otherDeductions;
  } catch { otherDeductions = null; }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.headerTitle}>Slip Gaji</Text>
          <Text style={styles.headerSub}>{slip.period?.name || slip.period?.periodName || '-'}</Text>
        </View>
        <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
          <Ionicons name="share-outline" size={18} color={C.primary} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary, marginLeft: 4 }}>Bagikan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Member Info */}
        <View style={styles.infoCard}>
          <Text style={styles.memberName}>{slip.nama || slip.member?.name || '-'}</Text>
          <Text style={styles.memberSub}>
            NRP: {slip.nrp || slip.member?.nrp || '-'}
            {slip.pangkat || slip.member?.pangkat ? ` · ${slip.pangkat || slip.member.pangkat}` : ''}
            {slip.member?.kesatuan ? ` · ${slip.member.kesatuan}` : ''}
          </Text>
        </View>

        {/* Earnings */}
        <Text style={styles.sectionTitle}>Penerimaan</Text>
        <View style={styles.sectionCard}>
          <Row label="Gaji Bersih" value={formatRp(Number(slip.gajiBersih) || 0)} />
          <Row label="Tunkin / Tunjangan Kinerja" value={formatRp(Number(slip.tunkin) || 0)} />
          <View style={[styles.rowItem, { borderTopWidth: 1, borderTopColor: C.border }]}>
            <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Total Penerimaan</Text>
            <Text style={[styles.rowValue, { fontWeight: '700', color: '#16A34A' }]}>
              {formatRp((Number(slip.gajiBersih) || 0) + (Number(slip.tunkin) || 0))}
            </Text>
          </View>
        </View>

        {/* Deductions */}
        <Text style={styles.sectionTitle}>Potongan Koperasi</Text>
        <View style={styles.sectionCard}>
          <Row label="Pot. Simpanan Wajib (TAJIB)" value={formatRp(Number(slip.potTajib) || 0)} color="#DC2626" />
          <Row label="Pot. Pinjaman SP" value={formatRp(Number(slip.potSP) || 0)} color="#DC2626" />
          <Row label="Pot. Barang (Toko)" value={formatRp(Number(slip.potBarang) || 0)} color="#DC2626" />
          <Row label="Pot. Sukarela" value={formatRp(Number(slip.potSukarela) || 0)} color="#DC2626" />
          <Row label="Pot. Koperasi Lainnya" value={formatRp(Number(slip.potKoperasiLain) || 0)} color="#DC2626" />
          {otherDeductions && Object.entries(otherDeductions).map(([key, val]) => (
            <Row key={key} label={`Pot. ${key}`} value={formatRp(val || 0)} color="#DC2626" />
          ))}
          <View style={[styles.rowItem, { borderTopWidth: 1, borderTopColor: C.border }]}>
            <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Total Potongan</Text>
            <Text style={[styles.rowValue, { fontWeight: '700', color: '#DC2626' }]}>
              {formatRp(Number(slip.totalPotKoperasi) || 0)}
            </Text>
          </View>
        </View>

        {/* Summary */}
        <Text style={styles.sectionTitle}>Ringkasan</Text>
        <View style={styles.sectionCard}>
          <Row label="Sisa Gaji" value={formatRp(Number(slip.sisaGaji) || 0)} bold />
          <Row label="Sisa Tunkin" value={formatRp(Number(slip.sisaTunkin) || 0)} bold />
          <Row label="Jumlah Pot. Non BRI" value={formatRp(Number(slip.jumlahPotNonBRI) || 0)} />
          <Row label="Jumlah Pot. BRI" value={formatRp(Number(slip.jumlahPotBRI) || 0)} />
          <View style={[styles.rowItem, { borderTopWidth: 2, borderTopColor: C.primary }]}>
            <Text style={[styles.rowLabel, { fontWeight: '800', fontSize: 15, color: C.primary }]}>Terima Bersih</Text>
            <Text style={[styles.rowValue, { fontWeight: '800', fontSize: 16, color: C.primary }]}>
              {formatRp(Number(slip.terimaBersih) || 0)}
            </Text>
          </View>
          <Row label="Sisa Rekening" value={formatRp(Number(slip.sisaRekening) || 0)} />
          <Row label="Bisa Diambil ATM" value={formatRp(Number(slip.bisaDiambilATM) || 0)} bold />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.rowItem}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function generateSlipHTML(slip: any): string {
  const f = (n: number) => (n || 0).toLocaleString('id-ID');
  const e = (s: string | undefined | null) => (s || '-').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const periode = e(slip.period?.name || slip.period?.periodName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:monospace;max-width:300px;margin:0 auto;padding:8px;font-size:12px}
    h2{text-align:center;font-size:14px;margin:4px 0}
    .sub{text-align:center;font-size:10px;color:#666;margin-bottom:8px}
    .row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #ccc}    .row.total{border-bottom:2px solid #000;font-weight:bold;margin-top:4px}
    .label{flex:1}.val{text-align:right;min-width:100px}
    .section{font-weight:bold;margin-top:8px;border-top:1px solid #000;padding-top:4px}
  </style></head><body>
    <h2>PRIMKOPPOL RESOR LUMAJANG</h2>
    <div class="sub">SLIP GAJI — ${periode}</div>
    <div class="row"><span class="label">Nama</span><span class="val">${e(slip.nama)}</span></div>
    <div class="row"><span class="label">NRP</span><span class="val">${e(slip.nrp)}</span></div>
    <div class="row"><span class="label">Pangkat</span><span class="val">${e(slip.pangkat)}</span></div>
    <div class="section">PENERIMAAN</div>
    <div class="row"><span class="label">Gaji Bersih</span><span class="val">Rp ${f(Number(slip.gajiBersih))}</span></div>
    <div class="row"><span class="label">Tunkin</span><span class="val">Rp ${f(Number(slip.tunkin))}</span></div>
    <div class="section">POTONGAN KOPERASI</div>
    <div class="row"><span class="label">Simpanan Wajib</span><span class="val">Rp ${f(Number(slip.potTajib))}</span></div>
    <div class="row"><span class="label">Pinjaman SP</span><span class="val">Rp ${f(Number(slip.potSP))}</span></div>
    <div class="row"><span class="label">Barang (Toko)</span><span class="val">Rp ${f(Number(slip.potBarang))}</span></div>
    <div class="row"><span class="label">Sukarela</span><span class="val">Rp ${f(Number(slip.potSukarela))}</span></div>
    <div class="row"><span class="label">Lainnya</span><span class="val">Rp ${f(Number(slip.potKoperasiLain))}</span></div>
    <div class="row total"><span class="label">TOTAL POTONGAN</span><span class="val">Rp ${f(Number(slip.totalPotKoperasi))}</span></div>
    <div class="section">RINGKASAN</div>
    <div class="row"><span class="label">Sisa Gaji</span><span class="val">Rp ${f(Number(slip.sisaGaji))}</span></div>
    <div class="row"><span class="label">Sisa Tunkin</span><span class="val">Rp ${f(Number(slip.sisaTunkin))}</span></div>
    <div class="row total"><span class="label">TERIMA BERSIH</span><span class="val">Rp ${f(Number(slip.terimaBersih))}</span></div>
    <div class="row"><span class="label">Sisa Rek.</span><span class="val">Rp ${f(Number(slip.sisaRekening))}</span></div>
    <div class="row"><span class="label">ATM</span><span class="val">Rp ${f(Number(slip.bisaDiambilATM))}</span></div>
    <div style="text-align:center;margin-top:12px;font-size:9px;color:#999">
      Dicetak: ${new Date().toLocaleDateString('id-ID')} — PRIMKOPPOL
    </div>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  printBtn: {
    backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  infoCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 16,
    alignItems: 'center',
  },
  memberName: { fontSize: 18, fontWeight: '700', color: C.primary },
  memberSub: { fontSize: 13, color: C.mutedForeground, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: C.mutedForeground, marginTop: 16, marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCard: {
    backgroundColor: C.card, borderRadius: 14, overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  rowLabel: { flex: 1, fontSize: 13, color: C.foreground },
  rowValue: { fontSize: 13, color: C.foreground, fontWeight: '500', textAlign: 'right' },
});
