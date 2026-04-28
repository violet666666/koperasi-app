import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function LaporanSimpananScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/mobile/reports/savings');
      setData(res.data.data);
    } catch (err: any) {
      console.log('Failed to load savings report:', err);
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
              <p style="margin: 5px 0;">Laporan Agregasi Simpanan</p>
              <hr style="border: 1px solid #D4AF37; margin-top: 10px;" />
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><b>Total Saldo Beredar</b></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 18px; color: #1A2A44;"><b>${formatRp(data.totalBalance)}</b></td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Total Rekening</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${data.totalAccounts || 0}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;">Total Bunga Berlaku</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${data.products?.length || 0} Produk</td>
              </tr>
            </table>

            <h3 style="color: #1A2A44;">Rincian Per Produk Simpanan</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #1A2A44; color: white;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Kode</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nama Produk</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Jml Rekening</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total Saldo</th>
                </tr>
              </thead>
              <tbody>
                ${data.products?.map((item: any) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.productCode}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.productName}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.accountCount}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><b>${formatRp(item.totalBalance)}</b></td>
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
              <Text style={styles.headerTitle}>📊 Rekap Simpanan</Text>
              <Text style={styles.headerSubtitle}>Laporan Agregasi Produk Simpanan</Text>
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
        
        <View style={styles.statGrid}>
          <View style={styles.cardHeader}>
             <Ionicons name="wallet" size={20} color={C.primary} />
             <Text style={styles.cardHeaderTitle}>Total Saldo Beredar</Text>
          </View>
          <Text style={styles.mainAmount}>{formatRp(data?.totalBalance)}</Text>
        </View>

        <View style={styles.cardRow}>
           <StatCard label="Total Rekening" value={data?.totalAccounts || '0'} icon="people" color={C.info} />
           <StatCard label="Produk Aktif" value={data?.products?.length || '0'} icon="cube" color={C.secondary} />
        </View>
        <View style={styles.cardRow}>
           <StatCard label="Total Setoran" value={formatRp(data?.deposits?.amount)} icon="trending-up" color={C.success} />
           <StatCard label="Total Penarikan" value={formatRp(data?.withdrawals?.amount)} icon="trending-down" color={C.warning} />
        </View>

        <Text style={styles.sectionTitle}>Detail Per Produk Simpanan</Text>

        {data?.products?.map((item: any, idx: number) => (
          <View key={idx} style={styles.productCard}>
             <View style={styles.productHeader}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.productCode}</Text></View>
                <Text style={styles.productName}>{item.productName}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Tipe Produk</Text>
                <Text style={styles.value}>{item.productType === 'mandatory' ? 'Wajib' : item.productType === 'principal' ? 'Pokok' : 'Sukarela'}</Text>
             </View>
             
             <View style={styles.rowBetween}>
                <Text style={styles.label}>Jml Rekening</Text>
                <Text style={styles.value}>{item.accountCount}</Text>
             </View>

             <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                <Text style={styles.labelBold}>Total Saldo</Text>
                <Text style={styles.valueBold}>{formatRp(item.totalBalance)}</Text>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardHeaderTitle: { fontSize: 13, color: C.mutedForeground, fontWeight: '600' },
  mainAmount: { fontSize: 28, fontWeight: 'bold', color: C.primary },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
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
  labelBold: { fontSize: 13, color: C.primary, fontWeight: '600' },
  valueBold: { fontSize: 14, color: C.success, fontWeight: 'bold' },
});
