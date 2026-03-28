import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) =>
  'Rp ' + Math.round(n).toLocaleString('id-ID');

interface SavingsAccount {
  id: number;
  accountNo: string;
  memberName: string;
  memberNo: string;
  nrp: string;
  memberId: number;
  productName: string;
  productType: string;
  balance: number;
}

interface Summary {
  totalBalance: number;
  totalAccounts: number;
  byProduct: {
    productName: string;
    productType: string;
    totalBalance: number;
    totalAccounts: number;
  }[];
}

export default function RekeningListScreen({ navigation }: any) {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchAccounts = useCallback(
    async (currentPage: number, searchVal: string, reset = false) => {
      if (currentPage === 1) {
        reset ? setIsRefreshing(true) : setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const res = await api.get('/api/mobile/savings-accounts', {
          params: { page: currentPage, search: searchVal },
        });
        const { data, summary: s, pagination } = res.data;

        if (currentPage === 1) {
          setAccounts(data);
          setSummary(s);
        } else {
          setAccounts((prev) => [...prev, ...data]);
        }
        setTotalPages(pagination.totalPages);
        setPage(currentPage);
      } catch (err: any) {
        Alert.alert(
          'Error',
          err.response?.data?.message || 'Gagal memuat data rekening'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      fetchAccounts(1, search);
    }, [])
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    fetchAccounts(1, text);
  };

  const handleRefresh = () => {
    fetchAccounts(1, search, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && page < totalPages) {
      fetchAccounts(page + 1, search);
    }
  };

  const handleTarikSetor = (item: SavingsAccount) => {
    navigation.navigate('SavingsTransaction', {
      memberId: item.memberId,
      memberName: item.memberName,
    });
  };

  const productTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      pokok: 'Pokok',
      wajib: 'Wajib',
      sukarela: 'Sukarela',
    };
    return map[type] || type;
  };

  const productTypeColor = (type: string) => {
    const map: Record<string, string> = {
      pokok: C.info,
      wajib: C.success,
      sukarela: C.accent,
    };
    return map[type] || C.mutedForeground;
  };

  const renderAccount = ({ item }: { item: SavingsAccount }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName} numberOfLines={1}>
            {item.memberName}
          </Text>
          <Text style={styles.memberNo}>
            {item.nrp || item.memberNo}
          </Text>
        </View>
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: productTypeColor(item.productType) + '20' },
          ]}
        >
          <Text
            style={[
              styles.typeBadgeText,
              { color: productTypeColor(item.productType) },
            ]}
          >
            {productTypeLabel(item.productType)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons
            name="wallet-outline"
            size={14}
            color={C.mutedForeground}
          />
          <Text style={styles.infoLabel}>
            {item.productName} · {item.accountNo}
          </Text>
        </View>
        <Text style={styles.balance}>{formatRp(item.balance)}</Text>
      </View>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => handleTarikSetor(item)}
        activeOpacity={0.8}
      >
        <Ionicons name="swap-vertical-outline" size={16} color={C.primary} />
        <Text style={styles.actionBtnText}>Setor / Tarik</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Summary Card */}
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Saldo</Text>
              <Text style={styles.summaryValue}>
                {formatRp(summary.totalBalance)}
              </Text>
            </View>
            <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
              <Text style={styles.summaryLabel}>Total Rekening</Text>
              <Text style={styles.summaryValue}>
                {summary.totalAccounts.toLocaleString('id-ID')}
              </Text>
            </View>
          </View>

          {summary.byProduct && summary.byProduct.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.byProductTitle}>Per Produk</Text>
              {summary.byProduct.map((p, i) => (
                <View key={i} style={styles.byProductRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: productTypeColor(p.productType) },
                      ]}
                    />
                    <Text style={styles.byProductName}>{p.productName}</Text>
                    <Text style={styles.byProductCount}>({p.totalAccounts})</Text>
                  </View>
                  <Text style={styles.byProductBalance}>
                    {formatRp(p.totalBalance)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons
          name="search-outline"
          size={18}
          color={C.mutedForeground}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / NRP anggota..."
          placeholderTextColor={C.mutedForeground}
          value={search}
          onChangeText={handleSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="albums-outline" size={48} color={C.muted} />
      <Text style={styles.emptyText}>
        {search ? 'Tidak ada rekening ditemukan' : 'Belum ada rekening simpanan'}
      </Text>
    </View>
  );

  const renderFooter = () =>
    isLoadingMore ? (
      <ActivityIndicator
        size="small"
        color={C.accent}
        style={{ paddingVertical: 16 }}
      />
    ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rekening Simpanan</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Memuat data rekening...</Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAccount}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[C.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    backgroundColor: C.primary,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: C.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  byProductTitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginBottom: 8,
  },
  byProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  byProductName: {
    color: '#FFF',
    fontSize: 13,
  },
  byProductCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  byProductBalance: {
    color: C.accentLight,
    fontSize: 13,
    fontWeight: '600',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.foreground,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.foreground,
    flex: 1,
  },
  memberNo: {
    fontSize: 12,
    color: C.mutedForeground,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: C.mutedForeground,
  },
  balance: {
    fontSize: 20,
    fontWeight: '700',
    color: C.success,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accentBg,
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.accent + '40',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primary,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: C.mutedForeground,
    fontSize: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: C.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
  },
});
