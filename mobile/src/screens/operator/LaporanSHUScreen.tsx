import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import C from "../../lib/colors";
import api from "../../lib/api";
import { formatRp } from "../../lib/constants";
import { log } from "../../utils/log";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Ikon section (mengganti emoji — satu stroke/ukuran konsisten)
const SectionTitle = ({ icon, label }: { icon: any; label: string }) => (
  <View style={styles.sectionTitleRow}>
    <Ionicons name={icon} size={16} color={C.primary} />
    <Text style={styles.sectionTitle}>{label}</Text>
  </View>
);

export default function LaporanSHUScreen({ navigation }: any) {
  const now = new Date();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Gagal load ≠ tidak ada data — error state + retry, bukan empty state
  const [error, setError] = useState(false);
  // 0 = Semua Bulan, 1-12 = specific month
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  // Detail pendapatan Simpan Pinjam (jasa, penalti pelunasan, dana resiko, denda)
  const [spIncome, setSpIncome] = useState<any>(null);
  const [showSpDetail, setShowSpDetail] = useState(false);

  const fetchSHU = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { year: selectedYear };
      if (selectedMonth > 0) params.month = selectedMonth;
      const [shuRes, spRes] = await Promise.all([
        api.get(`/api/mobile/reports/shu-calculator`, { params }),
        api.get(`/api/mobile/reports/sp-income`, { params }).catch(() => null),
      ]);
      setData(shuRes.data.data);
      setSpIncome(spRes?.data?.data || null);
    } catch (err) {
      log.warn("Error fetching shu:", err);
      setError(true);
      setData(null);
      setSpIncome(null);
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

  // Jangan bisa navigasi ke periode masa depan — SHU belum ada di sana
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const isAtOrFuturePeriod =
    selectedYear > nowYear || (selectedYear === nowYear && selectedMonth >= nowMonth);

  // Spinner full-screen hanya saat load pertama; ganti bulan = konten lama
  // tetap tampil + indikator inline (posisi baca tidak hilang)
  if (loading && !data && !error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.background }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan SHU</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Period Navigator */}
      <View style={styles.periodNav}>
        <TouchableOpacity
          onPress={prevPeriod}
          style={styles.navArrow}
          accessibilityLabel="Bulan sebelumnya"
        >
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
        <TouchableOpacity
          onPress={nextPeriod}
          style={[styles.navArrow, isAtOrFuturePeriod && styles.navArrowDisabled]}
          disabled={isAtOrFuturePeriod}
          accessibilityLabel="Bulan berikutnya"
          accessibilityState={{ disabled: isAtOrFuturePeriod }}
        >
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

      {/* ponytail: ScrollView + .map cukup utk ratusan baris (rincian SP per
          tahun). Konversi ke FlatList (ListHeader utk section atas) bila jank
          dilaporkan di device lama. */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
            <Text style={styles.errorText}>Gagal memuat data. Periksa koneksi Anda.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchSHU()}
              accessibilityLabel="Coba lagi memuat data SHU"
            >
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        ) : !data ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="pie-chart-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada data SHU untuk periode ini</Text>
          </View>
        ) : (
          <>
            {/* Ganti bulan: konten lama tetap tampil + indikator inline */}
            {loading && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            )}

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                {isMonthlyView ? "Proyeksi SHU" : "Total SHU"}
              </Text>
              <Text style={styles.summaryAmount}>
                {formatRp(data.netIncome)}
              </Text>
              {isMonthlyView && (
                <Text style={styles.proyeksiNote}>
                  SHU resmi dibagi setahun sekali saat RAT
                </Text>
              )}
            </View>

            {/* SHU Cuci Mobil Info — cyan khas beban cuci mobil (samakan dgn web) */}
            {data.totalCarwashBonus > 0 && (
              <View style={[styles.inExCard, { borderLeftColor: '#06B6D4', borderLeftWidth: 3, marginBottom: 12 }]}>
                <Text style={styles.inExLabel}>Beban SHU Cuci Mobil (Rp 2.000/transaksi)</Text>
                <Text style={[styles.inExAmount, { color: '#06B6D4' }]}>{formatRp(data.totalCarwashBonus || 0)}</Text>
                <Text style={{ fontSize: 10, color: C.mutedForeground, marginTop: 2 }}>Dipotong dari Laba Bersih, dicairkan ke anggota saat distribusi SHU</Text>
              </View>
            )}

            {/* Income & Expense Row */}
            <View style={styles.inExRow}>
              <View style={[styles.inExCard, { borderLeftColor: C.success, borderLeftWidth: 3 }]}>
                <Text style={styles.inExLabel}>Total Pendapatan</Text>
                <Text style={[styles.inExAmount, { color: C.success }]}>{formatRp(data.totalIncome || 0)}</Text>
              </View>
              <View style={[styles.inExCard, { borderLeftColor: C.destructive, borderLeftWidth: 3 }]}>
                <Text style={styles.inExLabel}>Total Beban</Text>
                <Text style={[styles.inExAmount, { color: C.destructive }]}>{formatRp(data.totalExpense || 0)}</Text>
              </View>
            </View>

            {/* Laba Kotor per Unit */}
            {Array.isArray(data.unitGrossProfit) && data.unitGrossProfit.length > 0 && (
              <View style={styles.section}>
                <SectionTitle icon="storefront-outline" label="Laba Kotor per Unit" />
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginBottom: 8 }}>
                  Pendapatan bersih item terjual = Omzet − HPP
                </Text>
                {data.unitGrossProfit.map((u: any) => (
                  <View key={u.unitType} style={styles.detailRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.detailLabel}>{u.label}</Text>
                      <Text style={{ fontSize: 10, color: C.mutedForeground, marginTop: 2 }}>
                        Omzet {formatRp(u.omzet)} · HPP {formatRp(u.hpp)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: C.success }}>
                        {formatRp(u.labaKotor)}
                      </Text>
                      <Text style={{ fontSize: 10, color: C.mutedForeground, marginTop: 2 }}>
                        {u.margin}% margin
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Income Details */}
            {Array.isArray(data.incomeDetails) && data.incomeDetails.length > 0 && (
              <View style={styles.section}>
                <SectionTitle icon="trending-up-outline" label="Rincian Pendapatan" />
                {data.incomeDetails.map((item: any) => (
                  <View key={item.code} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.name}</Text>
                    <Text style={[styles.detailAmount, { color: C.success }]}>{formatRp(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Detail Pendapatan Simpan Pinjam */}
            {spIncome?.totals?.total > 0 && (
              <View style={styles.section}>
                <SectionTitle icon="business-outline" label="Detail Pendapatan Simpan Pinjam" />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jasa Pinjaman (Bunga)</Text>
                  <Text style={[styles.detailAmount, { color: C.success }]}>{formatRp(spIncome.totals.jasa)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Penalti Pelunasan Dipercepat</Text>
                  <Text style={[styles.detailAmount, { color: C.success }]}>{formatRp(spIncome.totals.penaltiPelunasan)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Denda Keterlambatan</Text>
                  <Text style={[styles.detailAmount, { color: C.success }]}>{formatRp(spIncome.totals.denda)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dana Resiko (Admin Fee)</Text>
                  <Text style={[styles.detailAmount, { color: C.success }]}>{formatRp(spIncome.totals.danaResiko)}</Text>
                </View>
                <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: C.border, marginTop: 4, paddingTop: 8 }]}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.foreground }}>Total</Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: C.primary }}>{formatRp(spIncome.totals.total)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.spToggle}
                  onPress={() => setShowSpDetail(v => !v)}
                >
                  <Text style={styles.spToggleText}>
                    {showSpDetail ? "Sembunyikan" : "Lihat"} rincian transaksi ({spIncome.payments?.length || 0} angsuran, {spIncome.disbursements?.length || 0} pencairan)
                  </Text>
                  <Ionicons name={showSpDetail ? "chevron-up" : "chevron-down"} size={14} color={C.primary} />
                </TouchableOpacity>

                {showSpDetail && (
                  <>
                    {(spIncome.payments || []).map((p: any) => {
                      const extra = (p.penaltiPelunasan || 0) + (p.denda || 0);
                      if (!p.jasa && !extra) return null;
                      return (
                        <View key={`p-${p.id}`} style={styles.spRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.spName} numberOfLines={1}>{p.memberName}</Text>
                            <Text style={styles.spMeta} numberOfLines={1}>
                              {new Date(p.paymentDate).toLocaleDateString("id-ID")} · {p.loanNo}
                              {p.paymentType === "early_settlement" ? " · pelunasan" : ""}
                            </Text>
                          </View>
                          <Text style={styles.spAmount}>{formatRp(p.jasa + extra)}</Text>
                        </View>
                      );
                    })}
                    {(spIncome.disbursements || []).map((l: any) => (
                      <View key={`l-${l.id}`} style={styles.spRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.spName} numberOfLines={1}>{l.memberName}</Text>
                          <Text style={styles.spMeta} numberOfLines={1}>
                            {new Date(l.disbursementDate).toLocaleDateString("id-ID")} · {l.loanNo} · dana resiko
                          </Text>
                        </View>
                        <Text style={styles.spAmount}>{formatRp(l.danaResiko)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Expense Details */}
            {Array.isArray(data.expenseDetails) && data.expenseDetails.length > 0 && (
              <View style={styles.section}>
                <SectionTitle icon="trending-down-outline" label="Rincian Beban" />
                {data.expenseDetails.map((item: any) => (
                  <View key={item.code} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.name}</Text>
                    <Text style={[styles.detailAmount, { color: C.destructive }]}>{formatRp(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Allocations */}
            {Array.isArray(data.allocations) && data.allocations.length > 0 && (
              <>
                <SectionTitle icon="pie-chart-outline" label="Alokasi SHU Sesuai AD-ART" />
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
                        <Text style={styles.allocationAmount}>{formatRp(item.amount)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Top Members */}
            {Array.isArray(data.topMembers) && data.topMembers.length > 0 && (
              <>
                <SectionTitle icon="star-outline" label="Top 10 Anggota Penerima SHU" />
                {data.topMembers.map((member: any, index: number) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.rankBadge, index < 3 && styles.rankBadgeTop]}>
                  <Text style={[styles.rankText, index < 3 && { color: C.secondary }]}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberNo}>NRP: {member.memberNo || "-"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.memberShuLabel}>Jasa Modal & Pelayanan</Text>
                  <Text style={styles.memberShuAmount}>{formatRp(member.totalShu)}</Text>
                  {(member.carwashBonus || 0) > 0 && (
                    <Text style={{ fontSize: 10, color: '#06B6D4', marginTop: 2 }}>
                      SHU Cuci Mobil: {formatRp(member.carwashBonus)} ({member.carwashCount}x)
                    </Text>
                  )}
                </View>
              </View>
            ))}
              </>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Informasi Kalkulator SHU</Text>
              <Text style={styles.infoText}>
                Total simpanan global anggota aktif: {formatRp(data.summary?.totalSavingsAll || 0)}.
                Sistem mengalkulasikan jasa modal proporsional sesuai AD-ART Pasal 42.
              </Text>
              {data.totalCarwashBonus > 0 && (
                <Text style={[styles.infoText, { marginTop: 4 }]}>
                  Total SHU Cuci Mobil: {formatRp(data.totalCarwashBonus)} (Rp 2.000 × per transaksi anggota). Dibebankan ke pendapatan kotor PRIMKOPPOL.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },

  periodNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navArrow: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  navArrowDisabled: { opacity: 0.3 },
  periodLabel: { fontSize: 16, fontWeight: "700", color: C.foreground },
  proyeksiBadge: {
    marginTop: 2,
    backgroundColor: C.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  proyeksiBadgeText: { fontSize: 10, color: C.info, fontWeight: "600" },

  pillScroll: { backgroundColor: C.card, maxHeight: 44 },
  pillContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: "row" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.card,
  },
  pillActive: { backgroundColor: C.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: C.primary },
  pillTextActive: { color: "#FFF" },

  errorCard: { alignItems: "center", paddingTop: 60 },
  errorText: { color: C.mutedForeground, marginTop: 12, fontSize: 15, textAlign: "center" },
  retryBtn: {
    marginTop: 16, backgroundColor: C.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  retryText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  inlineLoading: { alignItems: "center", paddingVertical: 8 },

  summaryCard: {
    backgroundColor: C.card,
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
  summaryLabel: { fontSize: 13, color: C.mutedForeground, marginBottom: 4 },
  summaryAmount: { fontSize: 30, fontWeight: "800", color: C.primary },
  proyeksiNote: { fontSize: 11, color: C.warning, marginTop: 6, textAlign: "center" },

  inExRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  inExCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inExLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 4 },
  inExAmount: { fontSize: 14, fontWeight: "700" },

  section: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.primary },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: C.mutedForeground, flex: 1, marginRight: 8 },
  detailAmount: { fontSize: 13, fontWeight: "600" },
  spToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: C.infoBg,
  },
  spToggleText: { fontSize: 12, fontWeight: "600", color: C.primary },
  spRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.muted,
  },
  spName: { fontSize: 13, fontWeight: "600", color: C.foreground },
  spMeta: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  spAmount: { fontSize: 12, fontWeight: "700", color: C.success },

  allocationCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.muted,
  },
  allocationLeft: { flex: 1, marginRight: 12 },
  allocationLabel: { fontSize: 13, fontWeight: "600", color: C.foreground, marginBottom: 6 },
  progressBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  progressBar: { height: "100%", backgroundColor: C.primary, borderRadius: 3 },
  allocationPercent: { fontSize: 12, color: C.mutedForeground },
  allocationAmount: { fontSize: 13, fontWeight: "700", color: C.primary },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.muted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankBadgeTop: { backgroundColor: C.accentBg },
  rankText: { fontSize: 13, fontWeight: "bold", color: C.mutedForeground },
  memberName: { fontSize: 14, fontWeight: "700", color: C.foreground },
  memberNo: { fontSize: 11, color: C.mutedForeground },
  memberShuLabel: { fontSize: 10, color: C.mutedForeground, marginBottom: 2 },
  memberShuAmount: { fontSize: 13, fontWeight: "700", color: C.success },

  infoBox: {
    backgroundColor: C.infoBg,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: { fontSize: 13, fontWeight: "700", color: C.primary, marginBottom: 4 },
  infoText: { fontSize: 12, color: C.foreground, lineHeight: 18 },
});
