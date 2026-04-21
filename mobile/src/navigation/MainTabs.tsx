import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StorageManager } from '../lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '../lib/colors';

// Screens — all roles
import DashboardScreen from '../screens/common/DashboardScreen';
import ProfileScreen from '../screens/common/ProfileScreen';

// Screens — Anggota
import TransaksiScreen from '../screens/member/TransaksiScreen';
import PinjamanScreen from '../screens/member/PinjamanScreen';

// Screens — Operator / Admin
import ApprovalScreen from '../screens/operator/ApprovalScreen';
import MemberListScreen from '../screens/operator/MemberListScreen';

// Screens — Kasir
import KasirScreen from '../screens/kasir/KasirScreen';
import StokScreen from '../screens/kasir/StokScreen';
import ShiftScreen from '../screens/kasir/ShiftScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs({ setToken }: { setToken: (t: string | null) => void }) {
  const [role, setRole] = useState<string>('member');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const userData = StorageManager.getFastString('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      setRole(parsed.role || 'member');
    }
  }, []);

  const isOperator = role === 'operator' || role === 'admin' || role === 'superadmin';
  const isKasir = role === 'kasir';

  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.mutedForeground,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: 50 + bottomPadding,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Beranda: focused ? 'home' : 'home-outline',
            Transaksi: focused ? 'receipt' : 'receipt-outline',
            Pinjaman: focused ? 'cash' : 'cash-outline',
            Approval: focused ? 'checkmark-circle' : 'checkmark-circle-outline',
            Anggota: focused ? 'people' : 'people-outline',
            Kasir: focused ? 'cart' : 'cart-outline',
            Shift: focused ? 'time' : 'time-outline',
            Stok: focused ? 'cube' : 'cube-outline',
            Profil: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={iconMap[route.name] || 'home'} size={size} color={color} />;
        },
      })}
    >
      {/* Tab 1: Beranda (semua role) */}
      <Tab.Screen name="Beranda">
        {() => <DashboardScreen setToken={setToken} />}
      </Tab.Screen>

      {/* Tabs 2-3: Role-specific */}
      {isKasir ? (
        <>
          <Tab.Screen name="Shift" component={ShiftScreen} />
          <Tab.Screen name="Stok" component={StokScreen} />
        </>
      ) : isOperator ? (
        <>
          <Tab.Screen name="Approval" component={ApprovalScreen} />
          <Tab.Screen name="Anggota" component={MemberListScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="Transaksi" component={TransaksiScreen} />
          <Tab.Screen name="Pinjaman" component={PinjamanScreen} />
        </>
      )}

      {/* Tab 4: Profil (semua role) */}
      <Tab.Screen name="Profil">
        {() => <ProfileScreen setToken={setToken} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
