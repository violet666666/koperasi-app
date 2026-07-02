import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TouchableOpacity, Modal, ScrollView } from 'react-native';
import C from '../../lib/colors';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import { log } from '../../utils/log';

interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  authorName: string;
  createdAt: string;
}

const categoryIcon: Record<string, string> = {
  info: 'ℹ️', event: '📅', policy: '📋', promo: '🎁',
};

export default function PengumumanScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Announcement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/pengumuman?limit=50');
      setAnnouncements(res.data.data || []);
    } catch (err) {
      log.error('Pengumuman fetch error:', err);
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

  const renderItem = ({ item }: { item: Announcement }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedItem(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{categoryIcon[item.category] || 'ℹ️'}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {item.isPinned && <Ionicons name="pin" size={14} color={C.warning} />}
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          <Text style={styles.cardDate}>
            {new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' • '}{item.authorName}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
      </View>
      <Text style={styles.cardPreview} numberOfLines={2}>{item.content}</Text>
    </TouchableOpacity>
  );

  const canGoBack = navigation.canGoBack?.() ?? false;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {canGoBack && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>📢 Pengumuman</Text>
            <Text style={styles.headerSub}>Informasi & berita PRIMKOPPOL terbaru</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat pengumuman...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Belum ada pengumuman</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close-circle" size={28} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalMeta}>
              {selectedItem && new Date(selectedItem.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' • '}{selectedItem?.authorName}
            </Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalBody}>{selectedItem?.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerSub: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { fontSize: 22, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.primary, flex: 1 },
  cardDate: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
  cardPreview: { fontSize: 13, color: C.foreground, lineHeight: 20, marginTop: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: C.primary, flex: 1, marginRight: 12 },
  modalMeta: { fontSize: 12, color: C.mutedForeground, marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  modalBody: { fontSize: 15, color: C.foreground, lineHeight: 24 },
});
