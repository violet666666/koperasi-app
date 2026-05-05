import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type FilterType = 'all' | 'low_stock' | 'stock_in' | 'void_request' | 'expiring_soon' | 'batch_expired' | 'info';

const filterChips: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'low_stock', label: 'Stok' },
  { key: 'void_request', label: 'Void' },
  { key: 'expiring_soon', label: 'Expired' },
  { key: 'info', label: 'Info' },
];

const typeIconMap: Record<string, { icon: string; color: string }> = {
  low_stock: { icon: 'warning', color: '#F59E0B' },
  stock_in: { icon: 'add-circle', color: '#10B981' },
  void_request: { icon: 'refresh', color: '#8B5CF6' },
  expiring_soon: { icon: 'time', color: '#F97316' },
  batch_expired: { icon: 'trash', color: '#EF4444' },
  info: { icon: 'information-circle', color: '#3B82F6' },
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function NotifikasiScreen({ navigation: navProp }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [markingRead, setMarkingRead] = useState(false);

  const loadData = useCallback(async (filter?: FilterType) => {
    const typeFilter = filter ?? activeFilter;
    try {
      const res = await api.get(
        `/api/mobile/notifications?limit=50${typeFilter !== 'all' ? '&type=' + typeFilter : ''}`
      );
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount ?? 0);
      setMeta(res.data.meta ?? null);
    } catch (err) {
      console.log('Notifikasi fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setLoading(true);
    loadData(filter);
  };

  const handleMarkAllRead = async () => {
    if (markingRead || unreadCount === 0) return;
    setMarkingRead(true);
    try {
      await api.put('/api/mobile/notifications');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.log('Mark all read error:', err);
    } finally {
      setMarkingRead(false);
    }
  };

  const canGoBack = navProp?.canGoBack?.() ?? false;

  const renderItem = ({ item }: { item: Notification }) => {
    const iconInfo = typeIconMap[item.type] || typeIconMap.info;

    return (
      <View style={[styles.card, !item.isRead && styles.cardUnread]}>
        {!item.isRead && <View style={styles.unreadDot} />}
        <View style={styles.cardInner}>
          <View style={[styles.iconWrap, { backgroundColor: iconInfo.color + '18' }]}>
            <Ionicons name={iconInfo.icon as any} size={22} color={iconInfo.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>
            <Text style={styles.cardTime}>{getRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {canGoBack && (
              <TouchableOpacity onPress={() => navProp.goBack()} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Notifikasi</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSub}>{unreadCount} belum dibaca</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.markReadBtn, (markingRead || unreadCount === 0) && styles.markReadBtnDisabled]}
            onPress={handleMarkAllRead}
            disabled={markingRead || unreadCount === 0}
          >
            <Ionicons name="checkmark-done" size={16} color={unreadCount > 0 ? C.primary : C.mutedForeground} />
            <Text style={[styles.markReadText, unreadCount === 0 && styles.markReadTextDisabled]}>
              Tandai Dibaca
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterChips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.filterChip, activeFilter === chip.key && styles.filterChipActive]}
              onPress={() => handleFilterChange(chip.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, activeFilter === chip.key && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.emptyText}>Memuat notifikasi...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={56} color={C.muted} />
          <Text style={styles.emptyTitle}>Belum ada notifikasi</Text>
          <Text style={styles.emptyText}>Notifikasi stok, void, dan info akan muncul di sini</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />
          }
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    backgroundColor: C.primary,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: '#CBD5E1', fontSize: 13, marginTop: 2 },

  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  markReadBtnDisabled: { opacity: 0.5 },
  markReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },
  markReadTextDisabled: { color: C.mutedForeground },

  filterRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.muted,
  },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.muted,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.mutedForeground,
  },
  filterChipTextActive: { color: '#FFF' },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { flex: 1, paddingRight: 16 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.foreground,
    lineHeight: 20,
    marginBottom: 2,
  },
  cardMessage: {
    fontSize: 13,
    color: C.mutedForeground,
    lineHeight: 19,
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 11,
    color: C.mutedForeground,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.foreground,
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: C.mutedForeground,
    textAlign: 'center',
    marginTop: 6,
  },
});
