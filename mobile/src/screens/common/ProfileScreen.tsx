import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import C from '../../lib/colors';

export default function ProfileScreen({ setToken }: any) {
  const [user, setUser] = useState<any>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    const loadUser = async () => {
      const data = await SecureStore.getItemAsync('userData');
      if (data) setUser(JSON.parse(data));
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    Alert.alert('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('userToken');
          await SecureStore.deleteItemAsync('userData');
          setToken(null);
        }
      },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, color }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon} size={22} color={color || '#64748B'} />
      <Text style={[styles.menuLabel, color && { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#FFF" />
        </View>
        <Text style={styles.name}>{user?.name || 'Anggota'}</Text>
        <Text style={styles.role}>{user?.roleDisplayName || ''}</Text>
        {user?.nrp && <Text style={styles.nrp}>NRP: {user.nrp}</Text>}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <Text style={styles.sectionTitle}>Informasi Akun</Text>
        <View style={styles.menuContainer}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Peran</Text>
            <Text style={styles.infoValue}>{user?.role || '-'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="information-circle-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Versi</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>

        {/* Actions Section */}
        <Text style={styles.sectionTitle}>Pengaturan & Fitur</Text>
        <View style={styles.menuContainer}>
          <MenuItem icon="key-outline" label="Ganti Password" onPress={() => navigation.navigate('ChangePassword')} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 56, paddingBottom: 32, alignItems: 'center',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  name: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  role: { color: C.accent, fontSize: 14, fontWeight: '500', marginTop: 4 },
  nrp: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: C.mutedForeground, marginTop: 20, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuContainer: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.background, gap: 12,
  },
  infoLabel: { flex: 1, fontSize: 14, color: C.foreground },
  infoValue: { fontSize: 14, color: C.mutedForeground, fontWeight: '500' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.background, gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 14, color: C.foreground, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.destructive, padding: 16, borderRadius: 12, marginTop: 20,
  },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
