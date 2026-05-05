import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { StorageManager } from '../lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '../lib/colors';
import api from '../lib/api';

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
  const [unreadNotif, setUnreadNotif] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const userData = StorageManager.getFastString('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      const roleName = typeof parsed.role === 'object' ? parsed.role?.name : parsed.role;
      setRole(roleName || 'member');
    }
  }, []);

  const isOperator = ['operator', 'admin', 'superadmin', 'admin_unit'].includes(role);
  const isKasir = role === 'kasir';

  // Poll unread notification count for operators
  useEffect(() => {
    if (!isOperator) return;
    const fetchUnread = () => {
      api.get('/api/mobile/notifications?unread=true&limit=1')
        .then(res => setUnreadNotif(res.data?.unreadCount || 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isOperator]);

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
          return (
            <View>
              <Ionicons name={iconMap[route.name] || 'home'} size={size} color={color} />
              {route.name === 'Beranda' && unreadNotif > 0 && isOperator && (
                <View style={{
                  position: 'absolute', right: -8, top: -4,
                  backgroundColor: '#DC2626', borderRadius: 10,
                  minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                    {unreadNotif > 99 ? '99+' : unreadNotif}
                  </Text>
                </View>
              )}
            </View>
          );
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
