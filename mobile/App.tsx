import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
} from "react-native";

import LoginScreen from "./src/screens/auth/LoginScreen";
import MainTabs from "./src/navigation/MainTabs";

// Sub-screens (with back button via Stack header)
import ChangePasswordScreen from "./src/screens/auth/ChangePasswordScreen";
import LoanApplicationScreen from "./src/screens/member/LoanApplicationScreen";
import AnggotaCardScreen from "./src/screens/member/AnggotaCardScreen";
import SavingsTransactionScreen from "./src/screens/operator/SavingsTransactionScreen";
import LoanPaymentScreen from "./src/screens/operator/LoanPaymentScreen";
import LaporanSimpananScreen from "./src/screens/operator/LaporanSimpananScreen";
import LaporanPinjamanScreen from "./src/screens/operator/LaporanPinjamanScreen";
import MemberDetailScreen from "./src/screens/operator/MemberDetailScreen";
import PengumumanDetailScreen from "./src/screens/common/PengumumanDetailScreen";
import PengumumanScreen from "./src/screens/common/PengumumanScreen";
import ApprovalScreen from "./src/screens/operator/ApprovalScreen";
import MemberListScreen from "./src/screens/operator/MemberListScreen";
import KasirScreen from "./src/screens/kasir/KasirScreen";
import StokScreen from "./src/screens/kasir/StokScreen";

// New operator screens
import DaftarPinjamanScreen from "./src/screens/operator/DaftarPinjamanScreen";
import RekeningListScreen from "./src/screens/operator/RekeningListScreen";
import ProfilKoperasiScreen from "./src/screens/operator/ProfilKoperasiScreen";
import KasBankScreen from "./src/screens/operator/KasBankScreen";
import AuditLogScreen from "./src/screens/operator/AuditLogScreen";
const Stack = createNativeStackNavigator();

// ========== SPLASH SCREEN ==========
function SplashScreen() {
  return (
    <View style={splashStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2A44" />
      <View style={splashStyles.logoWrap}>
        <Image
          source={require("./assets/LogoPrimkoppol.png")}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.title}>PRIMKOPPOL</Text>
        <Text style={splashStyles.subtitle}>Koperasi Primer Kepolisian</Text>
      </View>
      <View style={splashStyles.bottom}>
        <ActivityIndicator size="small" color="#D4AF37" />
        <Text style={splashStyles.loadingText}>Memuat aplikasi...</Text>
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2A44",
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrap: {
    alignItems: "center",
  },
  logo: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#D4AF37",
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 8,
    letterSpacing: 1,
  },
  bottom: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 12,
  },
});

// ========== MAIN APP ==========
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync("userToken");
      } catch (e) {
        // Token retrieval failed
      }
      // Simulated minimum splash duration for branding
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setUserToken(token || null);
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} setToken={setUserToken} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main">
              {() => <MainTabs setToken={setUserToken} />}
            </Stack.Screen>

            {/* ====== Auth Sub-screens ====== */}
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
            />

            {/* ====== Member Sub-screens ====== */}
            <Stack.Screen
              name="LoanApplication"
              component={LoanApplicationScreen}
            />
            <Stack.Screen name="AnggotaCard" component={AnggotaCardScreen} />

            {/* ====== Operator Sub-screens ====== */}
            <Stack.Screen
              name="SavingsTransaction"
              component={SavingsTransactionScreen}
            />
            <Stack.Screen name="LoanPayment" component={LoanPaymentScreen} />
            <Stack.Screen
              name="LaporanSimpanan"
              component={LaporanSimpananScreen}
            />
            <Stack.Screen
              name="LaporanPinjaman"
              component={LaporanPinjamanScreen}
            />
            <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
            <Stack.Screen
              name="DaftarPinjaman"
              component={DaftarPinjamanScreen}
            />
            <Stack.Screen name="RekeningList" component={RekeningListScreen} />
            <Stack.Screen
              name="ProfilKoperasi"
              component={ProfilKoperasiScreen}
            />
            <Stack.Screen name="KasBankFull" component={KasBankScreen} />
            <Stack.Screen name="AuditLogFull" component={AuditLogScreen} />

            {/* ====== Common Sub-screens ====== */}
            <Stack.Screen
              name="PengumumanDetail"
              component={PengumumanDetailScreen}
            />
            <Stack.Screen name="Pengumuman" component={PengumumanScreen} />

            {/* ====== Full-screen Tab Alternatives (from Dashboard quick actions) ====== */}
            <Stack.Screen name="ApprovalFull" component={ApprovalScreen} />
            <Stack.Screen name="MemberListFull" component={MemberListScreen} />
            <Stack.Screen name="KasirFull" component={KasirScreen} />
            <Stack.Screen name="StokFull" component={StokScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
