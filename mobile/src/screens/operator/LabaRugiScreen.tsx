import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../common/colors";
import api from "../../lib/api";

type FinancialDataResponse = {
  period: string;
  labaRugi: {
    revenue: { items: any[]; total: number };
    expenses: { items: any[]; total: number };
    netIncome: number;
  };
};

export default function LabaRugiScreen({ navigation }: any) {
  const [data, setData] = useState<FinancialDataResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLabaRugi = async () => {
    try {
      const res = await api.get("/api/mobile/reports/financial");
      setData(res.data.data);
    } catch (error) {
      console.warn("Error fetching laba-rugi:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLabaRugi();
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

  const { labaRugi } = data;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 60, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Laporan Laba Rugi</Text>
        </View>
      </View>

      {/* Summary Card Ovelapping Header */}
      <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 14, color: C.mutedForeground }}>Laba / Rugi Bersih Berjalan</Text>
          <Text style={{ fontSize: 32, fontWeight: "bold", color: labaRugi.netIncome >= 0 ? C.primary : "#F43F5E", marginVertical: 8 }}>
            {formatRupiah(labaRugi.netIncome)}
          </Text>
          <View style={{ backgroundColor: "#e0f2fe", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
             <Text style={{ color: "#0284c7", fontWeight: "600", fontSize: 12 }}>Tahun {new Date(data.period).getFullYear()}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* PENDAPATAN */}
        <View style={{ backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" }}>
          <View style={{ backgroundColor: "#f1f5f9", padding: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>Pendapatan (Revenue)</Text>
          </View>
          {labaRugi.revenue.items.length === 0 ? (
            <Text style={{ padding: 16, color: C.mutedForeground, textAlign: "center" }}>Kosong</Text>
          ) : (
            labaRugi.revenue.items.map((item, idx) => (
              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                <Text style={{ fontSize: 14, color: C.foreground, flex: 1 }}>{item.code} - {item.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#10B981" }}>{formatRupiah(item.amount)}</Text>
              </View>
            ))
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: "#f8fafc" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>Total Pendapatan</Text>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#10B981" }}>{formatRupiah(labaRugi.revenue.total)}</Text>
          </View>
        </View>

        {/* BEBAN PENGELUARAN */}
        <View style={{ backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0" }}>
          <View style={{ backgroundColor: "#f1f5f9", padding: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>Beban (Expenses)</Text>
          </View>
          {labaRugi.expenses.items.length === 0 ? (
            <Text style={{ padding: 16, color: C.mutedForeground, textAlign: "center" }}>Kosong</Text>
          ) : (
            labaRugi.expenses.items.map((item, idx) => (
              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                <Text style={{ fontSize: 14, color: C.foreground, flex: 1 }}>{item.code} - {item.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#F43F5E" }}>{formatRupiah(item.amount)}</Text>
              </View>
            ))
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: "#f8fafc" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>Total Beban</Text>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#F43F5E" }}>{formatRupiah(labaRugi.expenses.total)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
