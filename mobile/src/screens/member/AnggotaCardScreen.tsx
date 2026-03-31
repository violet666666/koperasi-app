import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function AnggotaCardScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/mobile/summary');
        const userData = await SecureStore.getItemAsync('userData');
        const user = userData ? JSON.parse(userData) : {};
        setData({ ...res.data.data, user: { ...res.data.data?.user, ...user } });
      } catch (err) {
        console.log('Failed to load card data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kartu Anggota Digital</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card */}
          <View style={styles.card}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="shield-checkmark" size={28} color={C.accent} />
                <View>
                  <Text style={styles.orgName}>PRIMKOPPOL</Text>
                  <Text style={styles.orgSub}>Resor Lumajang</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Photo + Info */}
            <View style={styles.cardBody}>
              <View style={styles.photoFrame}>
                <Ionicons name="person" size={44} color="#FFF" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{data?.user?.name || 'Anggota'}</Text>
                <Text style={styles.cardNrp}>NRP: {data?.user?.nrp || '-'}</Text>
                <Text style={styles.cardRole}>{data?.user?.roleDisplayName || data?.user?.role || '-'}</Text>
              </View>
            </View>

            {/* Details Grid */}
            <View style={styles.detailGrid}>
              <DetailItem label="Email" value={data?.user?.email || '-'} icon="mail-outline" />
              <DetailItem label="Kategori" value={data?.user?.category || 'Polri'} icon="ribbon-outline" />
              <DetailItem label="Status" value="Aktif" icon="checkmark-circle-outline" />
            </View>

            {/* Financial Summary */}
            <View style={styles.finRow}>
              <View style={styles.finItem}>
                <Text style={styles.finLabel}>Total Simpanan</Text>
                <Text style={[styles.finValue, { color: C.success }]}>{formatRp(data?.savings?.totalBalance || 0)}</Text>
              </View>
              <View style={[styles.finItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.finLabel}>Pinjaman Aktif</Text>
                <Text style={[styles.finValue, { color: '#FBBF24' }]}>{data?.loans?.activeCount || 0}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>Berlaku selama menjadi anggota aktif koperasi</Text>
              <Text style={styles.footerDate}>Diterbitkan: {new Date().toLocaleDateString('id-ID')}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function DetailItem({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.6)" />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, alignItems: 'center' },
  card: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 16,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orgName: { fontSize: 18, fontWeight: 'bold', color: C.accent, letterSpacing: 2 },
  orgSub: { fontSize: 11, color: '#94A3B8' },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20 },
  cardBody: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'center' },
  photoFrame: {
    width: 80, height: 80, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.2)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(212,175,55,0.4)',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  cardNrp: { fontSize: 14, color: C.accent, fontWeight: '600', marginTop: 4 },
  cardRole: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  detailGrid: { paddingHorizontal: 20, gap: 12, paddingBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  detailValue: { fontSize: 13, color: '#FFF', fontWeight: '500' },
  finRow: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 20, borderRadius: 12, marginBottom: 16,
  },
  finItem: { flex: 1, padding: 14, alignItems: 'center' },
  finLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  finValue: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  cardFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  footerText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  footerDate: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
});
