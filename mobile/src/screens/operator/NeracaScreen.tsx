import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import C from "../../lib/colors";
import api from "../../lib/api";

export default function NeracaScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchNeraca = async () => {
    try {
      const res = await api.get("/api/mobile/reports/financial");
      setData(res.data.data);
    } catch (error) {
      console.warn("Error fetching neraca:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNeraca();
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

  const { neraca } = data;
  const isBalanced = neraca.isBalanced ?? (Math.abs(neraca.totalAssets - neraca.totalLiabilitiesAndEquity) < 1);

  const renderSection = (title: string, items: any[], total: number) => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Tidak ada data</Text>
      ) : (
        items.map((item: any, idx: number) => (
          <View key={idx} style={styles.row}>
            <Text style={styles.rowLabel}>{item.code} - {item.name}</Text>
            <Text style={styles.rowAmount}>{formatRupiah(item.amount)}</Text>
          </View>
        ))
      )}
      <View style={styles.sectionFooter}>
        <Text style={styles.footerLabel}>Total {title}</Text>
        <Text style={styles.footerAmount}>{formatRupiah(total)}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Laporan Neraca</Text>
          </View>
          {/* Validity Indicator */}
          {isBalanced ? (
             <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#059669", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Ionicons name="checkmark-circle" size={14} color="white" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 10, color: "white", fontWeight: "bold" }}>Seimbang</Text>
             </View>
          ) : (
             <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#E11D48", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Ionicons name="close-circle" size={14} color="white" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 10, color: "white", fontWeight: "bold" }}>Selisih</Text>
             </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* LEFT SIDE: ASSETS */}
          <Text style={styles.superTitle}>AKTIVA (ASET)</Text>
          {renderSection("Aset Lancar", neraca.assets.current, neraca.assets.totalCurrentAssets)}
          {renderSection("Aset Tetap", neraca.assets.fixed, neraca.assets.totalFixedAssets)}
          
          <View style={[styles.grandTotalBox, { backgroundColor: "#e0f2fe", borderColor: "#bae6fd" }]}>
             <Text style={styles.grandTotalLabel}>TOTAL ASET</Text>
             <Text style={[styles.grandTotalValue, { color: "#0369a1" }]}>{formatRupiah(neraca.assets.totalAssets)}</Text>
          </View>

          {/* RIGHT SIDE: LIABILITIES & EQUITY */}
          <Text style={[styles.superTitle, { marginTop: 24 }]}>PASIVA (KEWAJIBAN & EKUITAS)</Text>
          {renderSection("Kewajiban Jangka Pendek", neraca.liabilities.shortTerm, neraca.liabilities.totalLiabilities)}
          {renderSection("Ekuitas (Modal)", neraca.equity.items, neraca.equity.totalEquity)}

          <View style={[styles.grandTotalBox, { backgroundColor: "#fce7f3", borderColor: "#fbcfe8" }]}>
             <Text style={styles.grandTotalLabel}>TOTAL PASIVA</Text>
             <Text style={[styles.grandTotalValue, { color: "#be185d" }]}>{formatRupiah(neraca.totalLiabilitiesAndEquity)}</Text>
          </View>

          <View style={{ height: 40 }}/>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  superTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: C.primary,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionHeader: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.foreground,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  rowLabel: {
    fontSize: 13,
    color: C.foreground,
    flex: 1,
  },
  rowAmount: {
    fontSize: 13,
    color: C.mutedForeground,
  },
  sectionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: C.foreground,
  },
  footerAmount: {
    fontSize: 13,
    fontWeight: "bold",
    color: C.foreground,
  },
  emptyText: {
    padding: 16,
    color: C.mutedForeground,
    textAlign: "center",
    fontSize: 12,
  },
  grandTotalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#334155",
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: "bold",
  }
});
