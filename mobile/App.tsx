import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View, Text, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './src/screens/auth/LoginScreen';
import MainTabs from './src/navigation/MainTabs';

// Sub-screens (with back button via Stack header)
import ChangePasswordScreen from './src/screens/auth/ChangePasswordScreen';
import LoanApplicationScreen from './src/screens/member/LoanApplicationScreen';
import AnggotaCardScreen from './src/screens/member/AnggotaCardScreen';
import SavingsTransactionScreen from './src/screens/operator/SavingsTransactionScreen';
import LoanPaymentScreen from './src/screens/operator/LoanPaymentScreen';
import LaporanSimpananScreen from './src/screens/operator/LaporanSimpananScreen';
import LaporanPinjamanScreen from './src/screens/operator/LaporanPinjamanScreen';
import MemberDetailScreen from './src/screens/operator/MemberDetailScreen';
import PengumumanDetailScreen from './src/screens/common/PengumumanDetailScreen';
import PengumumanScreen from './src/screens/common/PengumumanScreen';
import ApprovalScreen from './src/screens/operator/ApprovalScreen';
import MemberListScreen from './src/screens/operator/MemberListScreen';
import KasirScreen from './src/screens/kasir/KasirScreen';
import StokScreen from './src/screens/kasir/StokScreen';

const Stack = createNativeStackNavigator();

// ========== SPLASH SCREEN ==========
function SplashScreen() {
  return (
    <View style={splashStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2A44" />
      <View style={splashStyles.logoWrap}>
        <View style={splashStyles.iconCircle}>
          <Ionicons name="shield-checkmark" size={56} color="#D4AF37" />
        </View>
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
    flex: 1, backgroundColor: '#1A2A44',
    justifyContent: 'center', alignItems: 'center',
  },
  logoWrap: { alignItems: 'center' },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(212,175,55,0.25)',
    marginBottom: 24,
  },
  title: {
    fontSize: 32, fontWeight: 'bold', color: '#D4AF37',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14, color: '#94A3B8', marginTop: 8,
    letterSpacing: 1,
  },
  bottom: {
    position: 'absolute', bottom: 60,
    alignItems: 'center', gap: 12,
  },
  loadingText: { color: '#64748B', fontSize: 12 },
});

// ========== MAIN APP ==========
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token;
      try {
        token = await SecureStore.getItemAsync('userToken');
      } catch (e) {
        // Token retrieval failed
      }
      // Simulated minimum splash duration for branding
      await new Promise(resolve => setTimeout(resolve, 1500));
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

            {/* ====== Sub-screens (all have their own back button in their custom header) ====== */}
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="LoanApplication" component={LoanApplicationScreen} />
            <Stack.Screen name="AnggotaCard" component={AnggotaCardScreen} />
            <Stack.Screen name="SavingsTransaction" component={SavingsTransactionScreen} />
            <Stack.Screen name="LoanPayment" component={LoanPaymentScreen} />
            <Stack.Screen name="LaporanSimpanan" component={LaporanSimpananScreen} />
            <Stack.Screen name="LaporanPinjaman" component={LaporanPinjamanScreen} />
            <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
            <Stack.Screen name="PengumumanDetail" component={PengumumanDetailScreen} />
            <Stack.Screen name="Pengumuman" component={PengumumanScreen} />
            
            {/* Full-screen versions of tab screens (for navigation from Dashboard quick actions) */}
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
