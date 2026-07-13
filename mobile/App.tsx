import React, { Suspense, useEffect, useRef, useState } from "react";
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
import Constants from "expo-constants";
import { setNavigateToLogin } from "./src/lib/api";
import { useIdleLogout } from "./src/lib/useIdleLogout";
import { registerForPushNotificationsAsync } from "./src/lib/notifications";

import LoginScreen from "./src/screens/auth/LoginScreen";
import MainTabs from "./src/navigation/MainTabs";

// Sub-screens — lazy loaded for faster startup
const ChangePasswordScreen = React.lazy(() => import("./src/screens/auth/ChangePasswordScreen"));
const LoanApplicationScreen = React.lazy(() => import("./src/screens/member/LoanApplicationScreen"));
const AnggotaCardScreen = React.lazy(() => import("./src/screens/member/AnggotaCardScreen"));
const SavingsTransactionScreen = React.lazy(() => import("./src/screens/operator/SavingsTransactionScreen"));
const LoanPaymentScreen = React.lazy(() => import("./src/screens/operator/LoanPaymentScreen"));
const LaporanSimpananScreen = React.lazy(() => import("./src/screens/operator/LaporanSimpananScreen"));
const LaporanPinjamanScreen = React.lazy(() => import("./src/screens/operator/LaporanPinjamanScreen"));
const MemberDetailScreen = React.lazy(() => import("./src/screens/operator/MemberDetailScreen"));
const PengumumanDetailScreen = React.lazy(() => import("./src/screens/common/PengumumanDetailScreen"));
const PengumumanScreen = React.lazy(() => import("./src/screens/common/PengumumanScreen"));
const ApprovalScreen = React.lazy(() => import("./src/screens/operator/ApprovalScreen"));
const MemberListScreen = React.lazy(() => import("./src/screens/operator/MemberListScreen"));
const KasirScreen = React.lazy(() => import("./src/screens/kasir/KasirScreen"));
const StokScreen = React.lazy(() => import("./src/screens/kasir/StokScreen"));
const ShiftScreen = React.lazy(() => import("./src/screens/kasir/ShiftScreen"));
const RiwayatKasirScreen = React.lazy(() => import("./src/screens/kasir/RiwayatKasirScreen"));
const EditNrpScreen = React.lazy(() => import("./src/screens/kasir/EditNrpScreen"));
const DaftarPinjamanScreen = React.lazy(() => import("./src/screens/operator/DaftarPinjamanScreen"));
const RiwayatAngsuranScreen = React.lazy(() => import("./src/screens/operator/RiwayatAngsuranScreen"));
const RekeningListScreen = React.lazy(() => import("./src/screens/operator/RekeningListScreen"));
const ProfilKoperasiScreen = React.lazy(() => import("./src/screens/operator/ProfilKoperasiScreen"));
const KasBankScreen = React.lazy(() => import("./src/screens/operator/KasBankScreen"));
const AuditLogScreen = React.lazy(() => import("./src/screens/operator/AuditLogScreen"));
const JurnalDaftarScreen = React.lazy(() => import("./src/screens/operator/JurnalDaftarScreen"));
const JurnalInputScreen = React.lazy(() => import("./src/screens/operator/JurnalInputScreen"));
const BukuBesarScreen = React.lazy(() => import("./src/screens/operator/BukuBesarScreen"));
const LabaRugiScreen = React.lazy(() => import("./src/screens/operator/LabaRugiScreen"));
const NeracaScreen = React.lazy(() => import("./src/screens/operator/NeracaScreen"));
const LaporanSHUScreen = React.lazy(() => import("./src/screens/operator/LaporanSHUScreen"));
const AsetListScreen = React.lazy(() => import("./src/screens/operator/AsetListScreen"));
const AsetDetailScreen = React.lazy(() => import("./src/screens/operator/AsetDetailScreen"));
const AsetFormScreen = React.lazy(() => import("./src/screens/operator/AsetFormScreen"));
const MasterDataHubScreen = React.lazy(() => import("./src/screens/operator/MasterDataHubScreen"));
const ImportDataScreen = React.lazy(() => import("./src/screens/operator/ImportDataScreen"));
const KwitansiListScreen = React.lazy(() => import("./src/screens/operator/KwitansiListScreen"));
const KwitansiFormScreen = React.lazy(() => import("./src/screens/operator/KwitansiFormScreen"));
const BukuKasScreen = React.lazy(() => import("./src/screens/operator/BukuKasScreen"));
const PengeluaranOperasionalScreen = React.lazy(() => import("./src/screens/operator/PengeluaranOperasionalScreen"));
const LaporanCuciMobilScreen = React.lazy(() => import("./src/screens/operator/LaporanCuciMobilScreen"));
const DirectDisburseScreen = React.lazy(() => import("./src/screens/operator/DirectDisburseScreen"));
const KwitansiViewerScreen = React.lazy(() => import("./src/screens/common/KwitansiViewerScreen"));
const NotifikasiScreen = React.lazy(() => import("./src/screens/common/NotifikasiScreen"));
const GajiPeriodeScreen = React.lazy(() => import("./src/screens/operator/GajiPeriodeScreen"));
const GajiSlipScreen = React.lazy(() => import("./src/screens/operator/GajiSlipScreen"));
const SlipGajiScreen = React.lazy(() => import("./src/screens/member/SlipGajiScreen"));
const BatchManagementScreen = React.lazy(() => import("./src/screens/operator/BatchManagementScreen"));
const KompenScreen = React.lazy(() => import("./src/screens/operator/KompenScreen"));
const LaporanPiutangGabunganScreen = React.lazy(() => import("./src/screens/operator/LaporanPiutangGabunganScreen"));
const KasBankTransaksiScreen = React.lazy(() => import("./src/screens/operator/KasBankTransaksiScreen"));
const KasBankTransferScreen = React.lazy(() => import("./src/screens/operator/KasBankTransferScreen"));
const LaporanUnitScreen = React.lazy(() => import("./src/screens/operator/LaporanUnitScreen"));
const LoanEditScreen = React.lazy(() => import("./src/screens/operator/LoanEditScreen"));
const PayrollImportScreen = React.lazy(() => import("./src/screens/operator/PayrollImportScreen"));
const HajiUmrahScreen = React.lazy(() => import("./src/screens/operator/HajiUmrahScreen"));
const HajiUmrahDetailScreen = React.lazy(() => import("./src/screens/operator/HajiUmrahDetailScreen"));
const HajiUmrahSetoranScreen = React.lazy(() => import("./src/screens/operator/HajiUmrahSetoranScreen"));
const HajiUmrahBukaRekeningScreen = React.lazy(() => import("./src/screens/operator/HajiUmrahBukaRekeningScreen"));
const HajiUmrahTalanganScreen = React.lazy(() => import("./src/screens/operator/HajiUmrahTalanganScreen"));

// Suspense wrapper for lazy screens
const LS = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}><ActivityIndicator color="#1A2A44" /></View>}>
    {children}
  </Suspense>
);

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
      // PENTING: Karena LoginScreen dirender kondisional (!userToken),
      // navigasi akan terjadi otomatis oleh React Navigation.
      // Memanggil navRef.current?.reset() di sini akan menyebabkan error "not handled by any navigator".
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
      if (Constants.appOwnership !== 'expo') {
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
      }
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
            <Stack.Screen name="ChangePassword">{() => <LS><ChangePasswordScreen /></LS>}</Stack.Screen>

            {/* ====== Member Sub-screens ====== */}
            <Stack.Screen name="LoanApplication">{() => <LS><LoanApplicationScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="AnggotaCard">{() => <LS><AnggotaCardScreen /></LS>}</Stack.Screen>

            {/* ====== Operator Sub-screens ====== */}
            <Stack.Screen name="SavingsTransaction">{() => <LS><SavingsTransactionScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LoanPayment">{() => <LS><LoanPaymentScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanSimpanan">{() => <LS><LaporanSimpananScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanPinjaman">{() => <LS><LaporanPinjamanScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="MemberDetail">{() => <LS><MemberDetailScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="DaftarPinjaman">{() => <LS><DaftarPinjamanScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="RiwayatAngsuran">{() => <LS><RiwayatAngsuranScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="RekeningList">{() => <LS><RekeningListScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="ProfilKoperasi">{() => <LS><ProfilKoperasiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KasBankFull">{() => <LS><KasBankScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="AuditLogFull">{() => <LS><AuditLogScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="JurnalDaftar">{() => <LS><JurnalDaftarScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="JurnalInput">{() => <LS><JurnalInputScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="BukuBesar">{() => <LS><BukuBesarScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LabaRugi">{() => <LS><LabaRugiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="Neraca">{() => <LS><NeracaScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanSHU">{() => <LS><LaporanSHUScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="AsetList">{() => <LS><AsetListScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="AsetDetail">{() => <LS><AsetDetailScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="AsetForm">{() => <LS><AsetFormScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="MasterDataHub">{() => <LS><MasterDataHubScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="ImportData">{() => <LS><ImportDataScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KwitansiList">{() => <LS><KwitansiListScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KwitansiForm">{() => <LS><KwitansiFormScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="BukuKasList">{() => <LS><BukuKasScreen /></LS>}</Stack.Screen>

            {/* ====== Common Sub-screens ====== */}
            <Stack.Screen name="PengumumanDetail">{() => <LS><PengumumanDetailScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="Pengumuman">{() => <LS><PengumumanScreen /></LS>}</Stack.Screen>

            {/* ====== Full-screen Tab Alternatives (from Dashboard quick actions) ====== */}
            <Stack.Screen name="ApprovalFull">{() => <LS><ApprovalScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="MemberListFull">{() => <LS><MemberListScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KasirFull">{() => <LS><KasirScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="StokFull">{() => <LS><StokScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="PengeluaranOperasional">{() => <LS><PengeluaranOperasionalScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="DirectDisburse">{() => <LS><DirectDisburseScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KwitansiViewer">{() => <LS><KwitansiViewerScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="ShiftKasir">{() => <LS><ShiftScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="RiwayatKasir">{() => <LS><RiwayatKasirScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="EditNrp">{() => <LS><EditNrpScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanCuciMobil">{() => <LS><LaporanCuciMobilScreen /></LS>}</Stack.Screen>

            {/* ====== New Screens (Sprint 8) ====== */}
            <Stack.Screen name="Notifikasi">{() => <LS><NotifikasiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="GajiPeriode">{() => <LS><GajiPeriodeScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="PayrollImport">{() => <LS><PayrollImportScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="GajiSlip">{() => <LS><GajiSlipScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="SlipGajiDetail">{() => <LS><SlipGajiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="SlipGajiList">{() => <LS><SlipGajiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="BatchManagement">{() => <LS><BatchManagementScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="Kompen">{() => <LS><KompenScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanPiutangGabungan">{() => <LS><LaporanPiutangGabunganScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KasBankTransaksi">{() => <LS><KasBankTransaksiScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="KasBankTransfer">{() => <LS><KasBankTransferScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LaporanUnit">{() => <LS><LaporanUnitScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="LoanEdit">{() => <LS><LoanEditScreen /></LS>}</Stack.Screen>

            {/* ====== Haji & Umrah Sub-screens (Fase 9a.1) ====== */}
            <Stack.Screen name="HajiUmrah">{() => <LS><HajiUmrahScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahDetail">{() => <LS><HajiUmrahDetailScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahSetoran">{() => <LS><HajiUmrahSetoranScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahBukaRekening">{() => <LS><HajiUmrahBukaRekeningScreen /></LS>}</Stack.Screen>
            <Stack.Screen name="HajiUmrahTalangan">{() => <LS><HajiUmrahTalanganScreen /></LS>}</Stack.Screen>
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
        await StorageManager.hydrateFastStorage();
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
