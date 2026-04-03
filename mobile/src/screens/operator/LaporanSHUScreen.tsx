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

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatRupiah = (num: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num || 0);

export default function LaporanSHUScreen({ navigation }: any) {
  const now = new Date();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // 0 = Semua Bulan, 1-12 = specific month
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchSHU = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { year: selectedYear };
      if (selectedMonth > 0) params.month = selectedMonth;
      const res = await api.get(`/api/mobile/reports/shu-calculator`, { params });
      setData(res.data.data);
    } catch (error) {
      console.warn("Error fetching shu:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useFocusEffect(
    useCallback(() => {
      fetchSHU();
    }, [fetchSHU])
  );

  const prevPeriod = () => {
    if (selectedMonth === 0) {
      // Semua bulan → geser tahun -1
      setSelectedYear(y => y - 1);
    } else if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextPeriod = () => {
    if (selectedMonth === 0) {
      setSelectedYear(y => y + 1);
    } else if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const periodLabel = selectedMonth === 0
    ? `Tahun ${selectedYear}`
    : `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  const isMonthlyView = selectedMonth > 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan SHU</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Navigator */}
      <View style={styles.periodNav}>
        <TouchableOpacity onPress={prevPeriod} style={styles.navArrow}>
          <Ionicons name="chevron-back" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          {isMonthlyView && (
            <View style={styles.proyeksiBadge}>
              <Text style={styles.proyeksiBadgeText}>Proyeksi Bulanan</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={nextPeriod} style={styles.navArrow}>
          <Ionicons name="chevron-forward" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Month Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillContent}>
        <TouchableOpacity
          style={[styles.pill, selectedMonth === 0 && styles.pillActive]}
          onPress={() => setSelectedMonth(0)}
        >
          <Text style={[styles.pillText, selectedMonth === 0 && styles.pillTextActive]}>Semua</Text>
        </TouchableOpacity>
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.pill, selectedMonth === i + 1 && styles.pillActive]}
            onPress={() => setSelectedMonth(i + 1)}
          >
            <Text style={[styles.pillText, selectedMonth === i + 1 && styles.pillTextActive]}>{m.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {!data ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="pie-chart-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada data SHU untuk periode ini</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                {isMonthlyView ? "Proyeksi SHU" : "Total SHU"}
              </Text>
              <Text style={styles.summaryAmount}>
                {formatRupiah(data.netIncome)}
              </Text>
              {isMonthlyView && (
                <Text style={styles.proyeksiNote}>
                  ⚠ SHU resmi dibagi setahun sekali saat RAT
                </Text>
              )}
            </View>

            {/* Income & Expense Row */}
            <View style={styles.inExRow}>
              <View style={[styles.inExCard, { borderLeftColor: "#10B981", borderLeftWidth: 3 }]}>
                <Text style={styles.inExLabel}>Total Pendapatan</Text>
                <Text style={[styles.inExAmount, { color: "#10B981" }]}>{formatRupiah(data.totalIncome || 0)}</Text>
              </View>
              <View style={[styles.inExCard, { borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
                <Text style={styles.inExLabel}>Total Beban</Text>
                <Text style={[styles.inExAmount, { color: "#EF4444" }]}>{formatRupiah(data.totalExpense || 0)}</Text>
              </View>
            </View>

            {/* Income Details */}
            {data.incomeDetails && data.incomeDetails.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📈 Rincian Pendapatan</Text>
                {data.incomeDetails.map((item: any) => (
                  <View key={item.code} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.name}</Text>
                    <Text style={[styles.detailAmount, { color: "#10B981" }]}>{formatRupiah(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expense Details */}
            {data.expenseDetails && data.expenseDetails.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📉 Rincian Beban</Text>
                {data.expenseDetails.map((item: any) => (
                  <View key={item.code} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.name}</Text>
                    <Text style={[styles.detailAmount, { color: "#EF4444" }]}>{formatRupiah(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Allocations */}
            <Text style={styles.sectionTitle}>📊 Alokasi SHU Sesuai AD-ART</Text>
            <View style={styles.allocationCard}>
              {data.allocations.map((item: any, idx: number) => (
                <View key={idx} style={styles.allocationRow}>
                  <View style={styles.allocationLeft}>
                    <Text style={styles.allocationLabel}>{item.label}</Text>
                    {/* Progress bar */}
                    <View style={styles.progressBg}>
                      <View style={[styles.progressBar, { width: `${item.percentage}%` as any }]} />
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.allocationPercent}>{item.percentage}%</Text>
                    <Text style={styles.allocationAmount}>{formatRupiah(item.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Top Members */}
            <Text style={styles.sectionTitle}>✨ Top 10 Anggota Penerima SHU</Text>
            {data.topMembers.map((member: any, index: number) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.rankBadge, index < 3 && styles.rankBadgeTop]}>
                  <Text style={[styles.rankText, index < 3 && { color: "#854D0E" }]}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberNo}>NRP: {member.memberNo || "-"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.memberShuLabel}>Jasa Modal & Pelayanan</Text>
                  <Text style={styles.memberShuAmount}>{formatRupiah(member.totalShu)}</Text>
                </View>
              </View>
            ))}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Informasi Kalkulator SHU</Text>
              <Text style={styles.infoText}>
                Total simpanan global anggota aktif: {formatRupiah(data.summary?.totalSavingsAll || 0)}.
                Sistem mengalkulasikan jasa modal proporsional sesuai AD-ART Pasal 42.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: C.primary,
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  periodNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  navArrow: { padding: 8 },
  periodLabel: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  proyeksiBadge: {
    marginTop: 2,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  proyeksiBadgeText: { fontSize: 10, color: "#1d4ed8", fontWeight: "600" },

  pillScroll: { backgroundColor: "#FFF", maxHeight: 44 },
  pillContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: "row" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: "#FFF",
  },
  pillActive: { backgroundColor: C.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: C.primary },
  pillTextActive: { color: "#FFF" },

  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  summaryAmount: { fontSize: 30, fontWeight: "800", color: C.primary },
  proyeksiNote: { fontSize: 11, color: "#f59e0b", marginTop: 6, textAlign: "center" },

  inExRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  inExCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inExLabel: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  inExAmount: { fontSize: 14, fontWeight: "700" },

  section: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 10,
    marginTop: 4,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: "#64748b", flex: 1, marginRight: 8 },
  detailAmount: { fontSize: 13, fontWeight: "600" },

  allocationCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  allocationLeft: { flex: 1, marginRight: 12 },
  allocationLabel: { fontSize: 13, fontWeight: "600", color: "#1e293b", marginBottom: 6 },
  progressBg: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  progressBar: { height: "100%", backgroundColor: C.primary, borderRadius: 3 },
  allocationPercent: { fontSize: 12, color: "#64748b" },
  allocationAmount: { fontSize: 13, fontWeight: "700", color: C.primary },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankBadgeTop: { backgroundColor: "#FEF08A" },
  rankText: { fontSize: 13, fontWeight: "bold", color: "#64748b" },
  memberName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  memberNo: { fontSize: 11, color: "#64748b" },
  memberShuLabel: { fontSize: 10, color: "#64748b", marginBottom: 2 },
  memberShuAmount: { fontSize: 13, fontWeight: "700", color: "#10B981" },

  infoBox: {
    backgroundColor: "#eff6ff",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoTitle: { fontSize: 13, fontWeight: "700", color: "#1e3a8a", marginBottom: 4 },
  infoText: { fontSize: 12, color: "#2563eb", lineHeight: 18 },
});
