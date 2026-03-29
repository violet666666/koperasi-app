import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../common/colors";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";

type JournalLine = {
  id: number;
  accountId: number;
  debit: string;
  credit: string;
  description: string;
};

type JournalEntry = {
  id: number;
  journalNo: string;
  transactionDate: string;
  description: string;
  sourceType: string;
  isAdjustment: boolean;
  totalDebit: number;
  totalCredit: number;
  creator: string;
  linesCount: number;
};

export default function JurnalDaftarScreen({ navigation }: any) {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("current"); // current, last, year, all

  const fetchJournals = async () => {
    try {
      const res = await api.get(`/api/mobile/journals?period=${period}`);
      setJournals(res.data.data || []);
    } catch (error) {
      console.warn("Error fetching journals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchJournals();
    }, [period])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchJournals();
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderFilterTab = (label: string, value: string) => {
    const isActive = period === value;
    return (
      <TouchableOpacity
        style={{
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 16,
          backgroundColor: isActive ? C.primary : "#e2e8f0",
          marginRight: 8,
        }}
        onPress={() => setPeriod(value)}
      >
        <Text style={{ color: isActive ? "white" : "#475569", fontWeight: "600", fontSize: 13 }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderJournalCard = ({ item }: { item: JournalEntry }) => (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground, marginBottom: 4 }}>
            {item.description}
          </Text>
          <Text style={{ fontSize: 12, color: C.mutedForeground }}>
            {item.journalNo} • {formatDate(item.transactionDate)}
          </Text>
        </View>
        {item.isAdjustment && (
          <View style={{ backgroundColor: "#FEF08A", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 10, color: "#854D0E", fontWeight: "bold" }}>MANUAL</Text>
          </View>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: "#f1f5f9", marginVertical: 8 }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 12, color: C.mutedForeground }}>Total Debit</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#10B981" }}>
            {formatRupiah(item.totalDebit)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 12, color: C.mutedForeground }}>Total Kredit</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#F43F5E" }}>
            {formatRupiah(item.totalCredit)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="list" size={12} color={C.mutedForeground} style={{ marginRight: 4 }} />
        <Text style={{ fontSize: 12, color: C.mutedForeground }}>{item.linesCount} baris entri</Text>
        <Text style={{ fontSize: 12, color: C.mutedForeground, marginHorizontal: 6 }}>•</Text>
        <Ionicons name="person" size={12} color={C.mutedForeground} style={{ marginRight: 4 }} />
        <Text style={{ fontSize: 12, color: C.mutedForeground }}>{item.creator}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Riwayat Jurnal</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
        {renderFilterTab("Bulan Ini", "current")}
        {renderFilterTab("Bulan Lalu", "last")}
        {renderFilterTab("Tahun Ini", "year")}
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderJournalCard}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="document-text-outline" size={64} color="#cbd5e1" />
              <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada jurnal di periode ini.</Text>
            </View>
          }
        />
      )}

      {/* FAB Floating Action Button */}
      <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 30,
          right: 20,
          backgroundColor: C.accent,
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#0EA5E9",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }}
        onPress={() => navigation.navigate("JurnalInput")}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}
