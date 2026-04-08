import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import C from '../../lib/colors';

export default function KwitansiViewerScreen({ route, navigation }: any) {
  const { receiptId } = route.params;
  const url = `https://www.primkoppol.online/kwitansi/${receiptId}/cetak`;
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({
        url: url,
        width: 612, // Standard letter size
        height: 792,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Bagikan Kwitansi',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Gagal', 'Fitur berbagi tidak tersedia di perangkat ini');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal membuat file PDF');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Print.printAsync({
        url: url,
      });
    } catch (error) {
      console.log('User cancelled print or error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Kwitansi</Text>
      </View>

      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        onLoadEnd={() => setLoading(false)}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ marginTop: 12, color: C.mutedForeground }}>Memuat Kwitansi...</Text>
        </View>
      )}

      {/* Floating Action Bar */}
      {!loading && (
        <View style={styles.floatingBar}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]} onPress={handlePrint} disabled={exporting}>
            <Ionicons name="print-outline" size={20} color="#334155" />
            <Text style={[styles.actionText, { color: '#334155' }]}>Cetak Langsung</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleExportPDF} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="share-outline" size={20} color="#FFF" />
            )}
            <Text style={styles.actionText}>{exporting ? 'Memproses...' : 'Bagikan PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  floatingBar: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    flexDirection: 'row', gap: 12,
    backgroundColor: '#FFF', padding: 12, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12,
    elevation: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 12, borderRadius: 12,
  },
  actionText: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
});
