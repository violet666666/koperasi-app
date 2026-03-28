import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Member {
  id: number;
  memberNo: string;
  name: string;
  nrp: string | null;
  status: string;
  branch: string | null;
  totalSavings: number;
  totalLoanOutstanding: number;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function MemberListScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const navigation = useNavigation<any>();

  const loadData = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/members?search=${q ?? search}&limit=30`);
      setMembers(res.data.data || []);
    } catch (err) {
      console.log('Members fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadData(''); }, []);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleSearch = () => { loadData(search); };

  const renderItem = ({ item }: { item: Member }) => {
    const isExpanded = selectedId === item.id;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedId(isExpanded ? null : item.id)} activeOpacity={0.7}>
        <View style={styles.cardRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberSub}>{item.nrp || item.memberNo} {item.branch ? `• ${item.branch}` : ''}</Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
        </View>
        {isExpanded && (
          <View style={styles.detailSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Simpanan</Text>
              <Text style={[styles.detailValue, { color: C.success }]}>{formatRp(item.totalSavings)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sisa Pinjaman</Text>
              <Text style={[styles.detailValue, { color: C.destructive }]}>{formatRp(item.totalLoanOutstanding)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.badge, { backgroundColor: item.status === 'active' ? C.successBg : C.warningBg }]}>
                <Text style={[styles.badgeText, { color: item.status === 'active' ? C.success : C.warning }]}>
                  {item.status === 'active' ? 'Aktif' : item.status}
                </Text>
              </View>
            </View>

            {item.status === 'active' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.primaryLight }]}
                  onPress={() => navigation.navigate('SavingsTransaction', { memberId: item.id, memberName: item.name })}
                >
                  <Ionicons name="wallet-outline" size={16} color="#FFF" />
                  <Text style={styles.actionText}>Simpanan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.warning }]}
                  onPress={() => navigation.navigate('LoanPayment', { memberId: item.id, memberName: item.name })}
                >
                  <Ionicons name="cash-outline" size={16} color="#FFF" />
                  <Text style={styles.actionText}>Angsuran</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Anggota</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / NRP..."
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
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>Memuat data...</Text></View>
      ) : members.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Anggota tidak ditemukan</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentBg, justifyContent: 'center', alignItems: 'center' },
  memberName: { fontSize: 15, fontWeight: '600', color: C.primary },
  memberSub: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  detailSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailLabel: { fontSize: 13, color: C.mutedForeground },
  detailValue: { fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10
  },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
