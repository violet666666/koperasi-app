import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../common/colors";
import api from "../../lib/api";

export default function LaporanSHUScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSHU = async () => {
    try {
      const year = new Date().getFullYear();
      const res = await api.get(`/api/mobile/reports/shu-calculator?year=${year}`);
      setData(res.data.data);
    } catch (error) {
      console.warn("Error fetching shu:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSHU();
    }, [])
  );

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 60, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Kalkulasi SHU berjalan</Text>
        </View>
      </View>

      {/* Summary Card Ovelapping Header */}
      <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: C.mutedForeground }}>Estimasi Total Net Income Koperasi</Text>
          <Text style={{ fontSize: 32, fontWeight: "bold", color: C.primary, marginVertical: 8 }}>
            {formatRupiah(data.netIncome)}
          </Text>
          <View style={{ backgroundColor: "#e0f2fe", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
             <Text style={{ color: "#0284c7", fontWeight: "600", fontSize: 12 }}>Tahun Buku {data.year}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: C.primary, marginBottom: 12, marginLeft: 4 }}>
           Alokasi SHU Sesuai AD-ART
        </Text>

        <View style={{ backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0" }}>
          {data.allocations.map((item: any, idx: number) => (
             <View key={idx} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                   <Text style={{ fontSize: 14, fontWeight: "600", color: C.foreground }}>{item.label}</Text>
                   <Text style={{ fontSize: 14, fontWeight: "bold", color: C.primary }}>{formatRupiah(item.amount)}</Text>
                </View>
                
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                   {/* Progress Bar Background */}
                   <View style={{ flex: 1, height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, marginRight: 12, overflow: "hidden" }}>
                      <View style={{ width: `${item.percentage}%`, height: "100%", backgroundColor: C.accent, borderRadius: 4 }} />
                   </View>
                   <Text style={{ fontSize: 12, color: C.mutedForeground, width: 35 }}>{item.percentage}%</Text>
                </View>
             </View>
          ))}
        </View>

        <Text style={{ fontSize: 16, fontWeight: "bold", color: C.primary, marginBottom: 12, marginLeft: 4 }}>
           ✨ Top 10 Anggota Penerima SHU
        </Text>

        {data.topMembers.map((member: any, index: number) => (
           <View key={member.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: index < 3 ? "#FEF08A" : "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                 <Text style={{ fontSize: 14, fontWeight: "bold", color: index < 3 ? "#854D0E" : C.mutedForeground }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={{ fontSize: 15, fontWeight: "bold", color: C.foreground }}>{member.name}</Text>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>NRP: {member.memberNo || "-"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 2 }}>Jasa Modal & Pelayanan</Text>
                 <Text style={{ fontSize: 14, fontWeight: "bold", color: "#10B981" }}>{formatRupiah(member.totalShu)}</Text>
              </View>
           </View>
        ))}

        <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: "#bfdbfe" }}>
           <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1e3a8a", marginBottom: 4 }}>Informasi Kalkulator SHU</Text>
           <Text style={{ fontSize: 12, color: "#2563eb", lineHeight: 18 }}>
             Total simpanan global anggota aktif bernilai {formatRupiah(data.summary.totalSavingsAll)}. Sistem mengalkulasikan floor 6% sebagai nilai terendah jasa modal proporsional sesuai perpu web.
           </Text>
        </View>

      </ScrollView>
    </View>
  );
}
