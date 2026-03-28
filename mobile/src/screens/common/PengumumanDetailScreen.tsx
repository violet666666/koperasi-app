import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import C from '../../lib/colors';

export default function PengumumanDetailScreen({ route, navigation }: any) {
  const item = route?.params?.item;

  if (!item) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pengumuman</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.emptyText}>Data pengumuman tidak tersedia.</Text>
        </View>
      </View>
    );
  }

  const categoryIcons: Record<string, string> = {
    umum: 'megaphone-outline',
    keuangan: 'cash-outline',
    pinjaman: 'card-outline',
    toko: 'cart-outline',
    kegiatan: 'calendar-outline',
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Pengumuman</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Category Badge */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Ionicons name={(categoryIcons[item.category] || 'megaphone-outline') as any} size={14} color={C.accent} />
            <Text style={styles.categoryText}>{(item.category || 'Umum').toUpperCase()}</Text>
          </View>
          {item.isPinned && (
            <View style={[styles.categoryBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="pin" size={14} color="#D97706" />
              <Text style={[styles.categoryText, { color: '#D97706' }]}>DISEMATKAN</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Date */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={C.mutedForeground} />
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString('id-ID', { 
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
            })}
          </Text>
        </View>
        {item.author && (
          <View style={styles.dateRow}>
            <Ionicons name="person-outline" size={16} color={C.mutedForeground} />
            <Text style={styles.dateText}>{item.author.name || 'Admin'}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Content */}
        <Text style={styles.content}>{item.content}</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scrollView: { flex: 1, padding: 20 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accentBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: 'bold', color: C.primary, lineHeight: 30 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dateText: { fontSize: 13, color: C.mutedForeground },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
  content: { fontSize: 15, lineHeight: 26, color: C.foreground },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: C.mutedForeground },
});
