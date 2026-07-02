import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function LaporanPinjamanScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/mobile/reports/loans');
      setData(res.data.data);
    } catch (err: any) {
      log.error('Failed to load loans report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const exportPDF = async () => {
    if (!data) return;
    try {
      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #1A2A44;">PRIMKOPPOL RESOR LUMAJANG</h2>
              <p style="margin: 5px 0;">Laporan Agregasi Pinjaman</p>
              <hr style="border: 1px solid #D4AF37; margin-top: 10px;" />
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><b>Kolektibilitas Rasio</b></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 18px; color: ${data.avgCollectibility >= 90 ? 'green' : 'red'};"><b>${data.avgCollectibility || 0}%</b></td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Total Pinjaman Beredar</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${data.totalLoans || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Total Dana Dicairkan</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: blue;">${formatRp(data.totalDisbursed || 0)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Dana Sudah Dibayar</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: green;">${formatRp(data.totalPaid || 0)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Total Sisa Outstanding</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: red;"><b>${formatRp(data.totalOutstanding || 0)}</b></td>
              </tr>
            </table>

            <h3 style="color: #1A2A44;">Rincian Produk Pinjaman Aktif</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #1A2A44; color: white;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Produk</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Bunga</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total Cair</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Outstanding</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Kolektibilitas</th>
                </tr>
              </thead>
              <tbody>
                ${data.products?.map((item: any) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><b>${item.productCode}</b><br/><small>${item.productName}</small></td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.interestRate}%</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatRp(item.totalDisbursed)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: red;">${formatRp(item.totalOutstanding)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${item.collectibilityRatio >= 90 ? 'green' : 'red'};">${item.collectibilityRatio}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <p style="text-align: right; margin-top: 30px; font-size: 12px; color: #666;">
              Dicetak pada: ${new Date().toLocaleString('id-ID')}
            </p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memproses laporan PDF');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>📊 Rekap Pinjaman</Text>
              <Text style={styles.headerSubtitle}>Laporan Agregasi Produk Pinjaman</Text>
            </View>
          </View>
          {!loading && data && (
            <TouchableOpacity onPress={exportPDF} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
              <Ionicons name="print" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Ringkasan Total</Text>

        <View style={styles.cardRow}>
           <StatCard label="Total Pinjaman" value={data?.totalLoans || '0'} icon="albums" color={C.primary} />
           <StatCard 
             label="Kolektibilitas" 
             value={`${data?.avgCollectibility || 0}%`} 
             icon="shield-checkmark" 
             color={data?.avgCollectibility >= 90 ? C.success : C.warning} 
           />
        </View>

        <View style={styles.statGrid}>
           <BalanceRow label="Total Dicairkan" value={data?.totalDisbursed} color={C.info} />
           <BalanceRow label="Sudah Dibayar" value={data?.totalPaid} color={C.success} />
           <View style={styles.divider} />
           <BalanceRow label="Total Outstanding" value={data?.totalOutstanding} color={C.destructive} bold />
        </View>

        <Text style={styles.sectionTitle}>Detail Per Produk Pinjaman</Text>

        {data?.products?.map((item: any, idx: number) => (
          <View key={idx} style={styles.productCard}>
             <View style={styles.productHeader}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.productCode}</Text></View>
                <Text style={styles.productName}>{item.productName}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Suku Bunga</Text>
                <Text style={styles.value}>{item.interestRate}% / bln</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Dicairkan</Text>
                <Text style={styles.value}>{formatRp(item.totalDisbursed)}</Text>
             </View>

             <View style={styles.rowBetween}>
                <Text style={styles.label}>Outstanding</Text>
                <Text style={[styles.value, { color: C.destructive }]}>{formatRp(item.totalOutstanding)}</Text>
             </View>

             <View style={{ marginTop: 12, marginBottom: 4 }}>
                <View style={styles.rowBetween}>
                   <Text style={{ fontSize: 11, color: C.mutedForeground }}>Kolektibilitas Rasio</Text>
                   <Text style={{ fontSize: 11, fontWeight: 'bold', color: item.collectibilityRatio >= 90 ? C.success : C.warning }}>
                     {item.collectibilityRatio}%
                   </Text>
                </View>
                <View style={styles.progressBarBg}>
                   <View style={[styles.progressBarFill, { 
                       width: `${Math.min(item.collectibilityRatio || 0, 100)}%`,
                       backgroundColor: item.collectibilityRatio >= 90 ? C.success : item.collectibilityRatio >= 75 ? C.warning : C.destructive
                   }]} />
                </View>
             </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
      )}
    </View>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={[styles.stat, { borderLeftColor: color }]}>
       <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
         <Text style={styles.statLabel}>{label}</Text>
         <Ionicons name={icon} size={16} color={C.mutedForeground} />
       </View>
       <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function BalanceRow({ label, value, color, bold }: any) {
  return (
    <View style={styles.balanceRow}>
       <Text style={[styles.balanceLabel, bold && { fontWeight: 'bold', color: C.primary }]}>{label}</Text>
       <Text style={[styles.balanceValue, { color: color || C.foreground }, bold && { fontSize: 16 }]}>{formatRp(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 24, marginBottom: 12 },
  statGrid: {
    backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  balanceLabel: { fontSize: 14, color: C.mutedForeground },
  balanceValue: { fontSize: 15, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  productCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  badge: { backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: C.primary, fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' },
  productName: { fontSize: 15, fontWeight: 'bold', color: C.primary, flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, color: C.mutedForeground },
  value: { fontSize: 13, color: C.foreground, fontWeight: '500' },
  progressBarBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
});
