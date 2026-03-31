import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const CATEGORY_LABELS: Record<string, string> = {
  simpanan_pokok: "Simp. Pokok",
  simpanan_wajib: "Simp. Wajib",
  simpanan_sukarela: "Simp. Sukarela",
  angsuran_pokok: "Angsuran Pokok",
  jasa_pinjaman: "Jasa Pinjaman",
  pencairan_pinjaman: "Pencairan",
  biaya_operasional: "Biaya Ops.",
  transfer: "Transfer",
  lainnya: "Lain-lain",
};

interface Entry {
  id: number;
  transactionDate: string;
  transactionNo: string;
  description: string;
  category: string | null;
  debit: number;
  credit: number;
  saldo: number;
  accountName?: string;
}

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

export default function BukuKasScreen() {
  const navigation = useNavigation<any>();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState({
    openingBalance: 0,
    closingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { month, year };
      if (selectedAccount !== "all") params.accountId = selectedAccount;

      const res = await api.get("/api/mobile/buku-kas", { params });
      const d = res.data.data;
      setEntries(d.entries || []);
      setAccounts(d.accounts || []);
      setSummary({
        openingBalance: d.openingBalance || 0,
        closingBalance: d.closingBalance || 0,
        totalDebit: d.totalDebit || 0,
        totalCredit: d.totalCredit || 0,
      });
    } catch (err) {
      console.log("Failed to load buku kas:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedAccount]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectedAccountName = selectedAccount === "all"
    ? "Semua Akun"
    : accounts.find(a => String(a.id) === selectedAccount)?.name || "Akun";

  const renderEntry = ({ item, index }: { item: Entry; index: number }) => {
    const isKeluar = item.credit > 0;
    const dateStr = new Date(item.transactionDate).toLocaleDateString("id-ID", {
      day: "2-digit", month: "2-digit",
    });

    return (
      <View style={[styles.entryRow, isKeluar && styles.entryRowKeluar, index === 0 && { borderTopWidth: 0 }]}>
        {/* Left: Date + No */}
        <View style={styles.entryLeft}>
          <Text style={styles.entryDate}>{dateStr}</Text>
          <Text style={styles.entryNo} numberOfLines={1}>{item.transactionNo}</Text>
        </View>

        {/* Middle: Description */}
        <View style={styles.entryMiddle}>
          <Text style={styles.entryDesc} numberOfLines={2}>{item.description}</Text>
          {item.category && CATEGORY_LABELS[item.category] && (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{CATEGORY_LABELS[item.category]}</Text>
            </View>
          )}
        </View>

        {/* Right: Amount + Saldo */}
        <View style={styles.entryRight}>
          {item.debit > 0 ? (
            <Text style={[styles.entryAmount, { color: C.success }]}>+{formatRp(item.debit)}</Text>
          ) : (
            <Text style={[styles.entryAmount, { color: "#DC2626" }]}>-{formatRp(item.credit)}</Text>
          )}
          <Text style={styles.entrySaldo}>Saldo: {formatRp(item.saldo)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buku Kas</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={22} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Account Filter */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedAccount === "all" && styles.filterChipActive]}
            onPress={() => setSelectedAccount("all")}
          >
            <Ionicons name="wallet-outline" size={14} color={selectedAccount === "all" ? "#FFF" : C.primary} />
            <Text style={[styles.filterChipText, selectedAccount === "all" && styles.filterChipTextActive]}>
              Semua
            </Text>
          </TouchableOpacity>
          {accounts.map(acc => (
            <TouchableOpacity
              key={acc.id}
              style={[styles.filterChip, selectedAccount === String(acc.id) && styles.filterChipActive]}
              onPress={() => setSelectedAccount(String(acc.id))}
            >
              <Ionicons
                name={acc.type === "cash" ? "cash-outline" : "card-outline"}
                size={14}
                color={selectedAccount === String(acc.id) ? "#FFF" : C.primary}
              />
              <Text style={[styles.filterChipText, selectedAccount === String(acc.id) && styles.filterChipTextActive]}>
                {acc.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: C.successBg }]}>
          <Text style={styles.summaryLabel}>Masuk</Text>
          <Text style={[styles.summaryVal, { color: C.success }]}>{formatRp(summary.totalDebit)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#FEE2E2" }]}>
          <Text style={styles.summaryLabel}>Keluar</Text>
          <Text style={[styles.summaryVal, { color: "#DC2626" }]}>{formatRp(summary.totalCredit)}</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Saldo Awal</Text>
          <Text style={styles.balanceVal}>{formatRp(summary.openingBalance)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={C.mutedForeground} />
        <View style={[styles.balanceItem, { alignItems: "flex-end" }]}>
          <Text style={styles.balanceLabel}>Saldo Akhir</Text>
          <Text style={[styles.balanceVal, { color: C.primary, fontWeight: "800" }]}>{formatRp(summary.closingBalance)}</Text>
        </View>
      </View>

      {/* Entries */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
              <Text style={styles.emptyText}>Tidak ada transaksi pada periode ini</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
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

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  monthArrow: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: "700", color: C.foreground, marginHorizontal: 16 },

  filterRow: { backgroundColor: "#FFF", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  filterScroll: { paddingHorizontal: 12, gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: "#FFF",
  },
  filterChipActive: { backgroundColor: C.primary },
  filterChipText: { fontSize: 12, fontWeight: "600", color: C.primary },
  filterChipTextActive: { color: "#FFF" },

  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12 },
  summaryLabel: { fontSize: 11, color: C.mutedForeground, fontWeight: "500" },
  summaryVal: { fontSize: 16, fontWeight: "bold", marginTop: 2 },

  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#FFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  balanceItem: {},
  balanceLabel: { fontSize: 10, color: C.mutedForeground, fontWeight: "500" },
  balanceVal: { fontSize: 14, fontWeight: "700", color: C.foreground, marginTop: 2 },

  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 30 },

  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderRadius: 0,
  },
  entryRowKeluar: { backgroundColor: "#FEF2F2" },

  entryLeft: { width: 70, marginRight: 8 },
  entryDate: { fontSize: 13, fontWeight: "700", color: C.foreground },
  entryNo: { fontSize: 9, color: C.mutedForeground, marginTop: 2, fontFamily: "monospace" },

  entryMiddle: { flex: 1, marginRight: 8 },
  entryDesc: { fontSize: 13, fontWeight: "500", color: C.foreground, lineHeight: 18 },
  catBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.primaryLight,
  },
  catBadgeText: { fontSize: 9, fontWeight: "600", color: "#FFF" },

  entryRight: { alignItems: "flex-end", minWidth: 90 },
  entryAmount: { fontSize: 13, fontWeight: "bold" },
  entrySaldo: { fontSize: 10, color: C.mutedForeground, marginTop: 3, fontWeight: "500" },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  loadingText: { fontSize: 14, color: C.mutedForeground },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: C.mutedForeground, marginTop: 12, fontStyle: "italic" },
});
