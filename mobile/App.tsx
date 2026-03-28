import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from './src/screens/auth/LoginScreen';
import MainTabs from './src/navigation/MainTabs';
import ChangePasswordScreen from './src/screens/auth/ChangePasswordScreen';
import LoanApplicationScreen from './src/screens/member/LoanApplicationScreen';
import SavingsTransactionScreen from './src/screens/operator/SavingsTransactionScreen';
import LoanPaymentScreen from './src/screens/operator/LoanPaymentScreen';
import LaporanSimpananScreen from './src/screens/operator/LaporanSimpananScreen';
import LaporanPinjamanScreen from './src/screens/operator/LaporanPinjamanScreen';

const Stack = createNativeStackNavigator();

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
      setUserToken(token || null);
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A2A44' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
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
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="LoanApplication" component={LoanApplicationScreen} />
            <Stack.Screen name="SavingsTransaction" component={SavingsTransactionScreen} />
            <Stack.Screen name="LoanPayment" component={LoanPaymentScreen} />
            <Stack.Screen name="LaporanSimpanan" component={LaporanSimpananScreen} />
            <Stack.Screen name="LaporanPinjaman" component={LaporanPinjamanScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
