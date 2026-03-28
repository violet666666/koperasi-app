import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../../lib/api';

export default function LoginScreen({ setToken }: any) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'NRP atau password wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/mobile/login', { identifier, password });
      
      const { token, user } = response.data;
      
      // Simpan JWT Token dengan aman ke Keychain HP
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      
      // Update state aplikasi agar pindah ke Dashboard
      setToken(token);
    } catch (error: any) {
      // Menangkap respon error JSON dari API Next.js Web
      const message = error.response?.data?.message || 'Gagal terhubung ke server website Koperasi. Pastikan IP Address benar.';
      Alert.alert('Login Gagal', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.title}>PRIMKOPPOL</Text>
        <Text style={styles.subtitle}>Mobile Application</Text>
      </View>
      
      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="NRP / Email Koperasi"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text style={styles.buttonText}>LOGIN SEKARANG</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helperText}>
          Login sebagai Anggota menggunakan NRP sesuai portal Web.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2A44',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D4AF37',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  button: {
    backgroundColor: '#D4AF37',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#1A2A44',
    fontWeight: 'bold',
    fontSize: 16,
  },
  helperText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
  }
});
