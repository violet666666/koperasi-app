import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StorageManager } from "./src/lib/storage";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
} from "react-native";
import { setNavigateToLogin } from "./src/lib/api";
import { useIdleLogout } from "./src/lib/useIdleLogout";
import { registerForPushNotificationsAsync } from "./src/lib/notifications";

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
import JurnalDaftarScreen from "./src/screens/operator/JurnalDaftarScreen";
import JurnalInputScreen from "./src/screens/operator/JurnalInputScreen";
import BukuBesarScreen from "./src/screens/operator/BukuBesarScreen";
import LabaRugiScreen from "./src/screens/operator/LabaRugiScreen";
import NeracaScreen from "./src/screens/operator/NeracaScreen";
import LaporanSHUScreen from "./src/screens/operator/LaporanSHUScreen";
import AsetListScreen from "./src/screens/operator/AsetListScreen";
import AsetDetailScreen from "./src/screens/operator/AsetDetailScreen";
import MasterDataHubScreen from "./src/screens/operator/MasterDataHubScreen";
import ImportDataScreen from "./src/screens/operator/ImportDataScreen";
import KwitansiListScreen from "./src/screens/operator/KwitansiListScreen";
import KwitansiFormScreen from "./src/screens/operator/KwitansiFormScreen";
import BukuKasScreen from "./src/screens/operator/BukuKasScreen";
import PengeluaranOperasionalScreen from "./src/screens/operator/PengeluaranOperasionalScreen";

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 2 } },
});

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
        <Text style={splashStyles.subtitle}>Resor Lumajang</Text>
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

// ========== INNER APP (dalam QueryClientProvider) ==========
function InnerApp({ userToken, setUserToken }: { userToken: string | null; setUserToken: (t: string | null) => void }) {
  const navRef = useRef<NavigationContainerRef<any>>(null);

  // S1-01: Daftarkan fungsi navigasi ke axios interceptor
  useEffect(() => {
    setNavigateToLogin(() => {
      setUserToken(null);
      navRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    });
  }, [setUserToken]);

  // S2-05: Idle logout (aktif hanya saat sudah login)
  useIdleLogout({
    onLogout: () => {
      setUserToken(null);
      navRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    },
  });

  // Push Notifications: registrasi token + handle tap notifikasi
  useEffect(() => {
    if (!userToken) return;

    // Daftarkan push token ke backend setelah login
    registerForPushNotificationsAsync().catch(() => {});

    // Handle saat user mengetuk notifikasi (app background/killed)
    let Notifications: any = null;
    let subscription: any = null;
    try {
      Notifications = require('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;
        if (!data?.screen) return;
        // Navigasi ke layar yang relevan berdasarkan data notifikasi
        setTimeout(() => {
          if (data.screen === 'TransaksiScreen') {
            navRef.current?.navigate('Main');
          } else if (data.screen === 'ApprovalScreen') {
            navRef.current?.navigate('Approval');
          }
        }, 500);
      });
    } catch (e) {}

    return () => {
      if (subscription?.remove) subscription.remove();
    };
  }, [userToken]);

  return (
    <NavigationContainer ref={navRef}>
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
            <Stack.Screen name="JurnalDaftar" component={JurnalDaftarScreen} />
            <Stack.Screen name="JurnalInput" component={JurnalInputScreen} />
            <Stack.Screen name="BukuBesar" component={BukuBesarScreen} />
            <Stack.Screen name="LabaRugi" component={LabaRugiScreen} />
            <Stack.Screen name="Neraca" component={NeracaScreen} />
            <Stack.Screen name="LaporanSHU" component={LaporanSHUScreen} />
            <Stack.Screen name="AsetList" component={AsetListScreen} />
            <Stack.Screen name="AsetDetail" component={AsetDetailScreen} />
            <Stack.Screen name="MasterDataHub" component={MasterDataHubScreen} />
            <Stack.Screen name="ImportData" component={ImportDataScreen} />
            <Stack.Screen name="KwitansiList" component={KwitansiListScreen} />
            <Stack.Screen name="KwitansiForm" component={KwitansiFormScreen} />
            <Stack.Screen name="BukuKasList" component={BukuKasScreen} />

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
            <Stack.Screen name="PengeluaranOperasional" component={PengeluaranOperasionalScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ========== MAIN APP ==========
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token: string | null = null;
      try {
        token = await StorageManager.getSecureItem("userToken");
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

  if (isLoading) return <SplashScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <InnerApp userToken={userToken} setUserToken={setUserToken} />
          <Toast />
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
