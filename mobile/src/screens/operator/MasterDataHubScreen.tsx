import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import C from "../../lib/colors";

type HubMenuItem = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  desc: string;
  disabled?: boolean;
};

export default function MasterDataHubScreen({ navigation }: any) {
  const menus: HubMenuItem[] = [
    {
      id: "announcements",
      title: "Pengumuman PRIMKOPPOL",
      icon: "megaphone",
      color: "#db2777",
      bgColor: "#fce7f3", // pink
      desc: "Distribusi informasi penting kepada seluruh anggota",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
             <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Sistem Pengaturan</Text>
             <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>Master Data Induk & Parameter Inti</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {menus.map((menu) => (
          <TouchableOpacity
            key={menu.id}
            disabled={menu.disabled}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "white",
              padding: 16,
              borderRadius: 16,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 3,
              opacity: menu.disabled ? 0.6 : 1,
              borderWidth: 1,
              borderColor: "#e2e8f0"
            }}
            onPress={() => {
              if (menu.id === 'announcements') {
                navigation.navigate('Pengumuman');
              }
            }}
          >
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: menu.bgColor, justifyContent: "center", alignItems: "center", marginRight: 16 }}>
               <Ionicons name={menu.icon as any} size={28} color={menu.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground, marginBottom: 4 }}>{menu.title}</Text>
              <Text style={{ fontSize: 12, color: C.mutedForeground, lineHeight: 18 }}>{menu.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.mutedForeground} />
          </TouchableOpacity>
        ))}

        <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: "#bfdbfe" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Ionicons name="information-circle-outline" size={20} color="#1e3a8a" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1e3a8a" }}>Catatan Penting</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#2563eb", lineHeight: 18 }}>
              Hanya administrator dan operator yang memiliki otorisasi untuk mengubah Master Data yang memengaruhi agregasi pencatatan pembukuan (seperti bunga, limit pinjaman, dll).
            </Text>
        </View>
      </ScrollView>
    </View>
  );
}
