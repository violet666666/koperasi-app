import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import api from "../../lib/api";
import C from "../../lib/colors";

const REMEMBER_KEY = "rememberedIdentifier";

export default function LoginScreen({ setToken }: any) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load saved identifier on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(REMEMBER_KEY);
        if (saved) {
          setIdentifier(saved);
          setRememberMe(true);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert("Error", "NRP atau password wajib diisi");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/api/mobile/login", {
        identifier,
        password,
      });
      const { token, user } = response.data;

      // Handle Remember Me
      if (rememberMe) {
        await SecureStore.setItemAsync(REMEMBER_KEY, identifier);
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_KEY);
      }

      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userData", JSON.stringify(user));
      setToken(token);
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        "Gagal terhubung ke server. Pastikan koneksi internet aktif.";
      Alert.alert("Login Gagal", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Branding */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../../assets/LogoPrimkoppol.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>PRIMKOPPOL LUMAJANG</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Masuk ke Akun</Text>

            {/* NRP / Email */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color={C.mutedForeground}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="NRP / Email Koperasi"
                placeholderTextColor="#94A3B8"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={C.mutedForeground}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={C.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.checkbox, rememberMe && styles.checkboxActive]}
              >
                {rememberMe && (
                  <Ionicons name="checkmark" size={13} color="#FFF" />
                )}
              </View>
              <Text style={styles.rememberText}>Ingat NRP / Email saya</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={C.primary} />
              ) : (
                <Text style={styles.buttonText}>MASUK</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Gunakan NRP atau Email sesuai akun portal Web Koperasi.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 300,
    height: 300,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: C.accent,
    letterSpacing: 3,
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 20,
    textAlign: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: "#2C3E50",
  },
  eyeBtn: {
    padding: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  checkboxActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  rememberText: {
    fontSize: 14,
    color: C.foreground,
    fontWeight: "500",
  },
  button: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: C.primary,
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  helperText: {
    marginTop: 24,
    textAlign: "center",
    color: "#64748B",
    fontSize: 12,
  },
});
