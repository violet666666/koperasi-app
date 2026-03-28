import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';

export default function ChangePasswordScreen({ navigation }: any) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Peringatan', 'Semua field wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Peringatan', 'Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Peringatan', 'Konfirmasi password tidak cocok');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/mobile/change-password', { currentPassword, newPassword });
      Alert.alert('Berhasil ✅', res.data.message || 'Password berhasil diubah', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal mengubah password';
      Alert.alert('Gagal', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ganti Password</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={styles.label}>Password Lama</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showCurrent}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Masukkan password lama"
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
            <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Password Baru</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimal 6 karakter"
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
            <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Konfirmasi Password Baru</Text>
        <TextInput
          style={[styles.input, { paddingRight: 16 }]}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password baru"
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitText}>{loading ? 'Menyimpan...' : 'Simpan Password Baru'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  form: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: C.foreground, marginBottom: 8, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  input: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.foreground, borderWidth: 1, borderColor: C.border,
  },
  eyeBtn: { position: 'absolute', right: 12, padding: 4 },
  submitBtn: {
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 32,
  },
  submitText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
