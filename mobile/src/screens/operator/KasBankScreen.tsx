import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "../../lib/api";
import C from "../../lib/colors";
import { log } from "../../utils/log";
import { StorageManager } from "../../lib/storage";

const formatRp = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function KasBankScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get("/api/mobile/kas-bank");
      setData(res.data.data);
    } catch (err) {
      log.error("Failed to load kas bank:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totals = data?.totals || { cash: 0, bank: 0, total: 0 };
  const accounts = data?.accounts || [];
  const latestTx = data?.latestTransactions || [];

  const cashAccounts = accounts.filter((a: any) => a.type === "cash");
  const bankAccounts = accounts.filter((a: any) => a.type === "bank");

  const userRole = useMemo(() => {
    const ud = StorageManager.getFastString("userData");
    if (ud) { const p = JSON.parse(ud); return typeof p.role === "object" ? p.role?.name : p.role; }
    return "";
  }, []);
  const canCreate = userRole === "operator" || userRole === "admin" || userRole === "admin_sp";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kas & Bank</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Totals Cards */}
        <View style={styles.cardRow}>
          <View style={[styles.summaryCard, { backgroundColor: C.successBg }]}>
            <Ionicons name="wallet-outline" size={24} color={C.success} />
            <Text style={styles.summaryLabel}>Total Kas</Text>
            <Text style={[styles.summaryValue, { color: C.success }]}>
              {formatRp(totals.cash)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: C.infoBg }]}>
            <Ionicons name="business-outline" size={24} color={C.info} />
            <Text style={styles.summaryLabel}>Total Bank</Text>
            <Text style={[styles.summaryValue, { color: C.info }]}>
              {formatRp(totals.bank)}
            </Text>
          </View>
        </View>
        <View style={[styles.summaryCardFull, { backgroundColor: C.primaryLight }]}>
          <Text style={styles.summaryLabelFull}>Total Keseluruhan</Text>
          <Text style={styles.summaryValueFull}>{formatRp(totals.total)}</Text>
        </View>

        {/* Action buttons — operator/admin/admin_sp only */}
        {canCreate && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.navigate("KasBankTransaksi")}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Transaksi Baru</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.accent }]}
              onPress={() => navigation.navigate("KasBankTransfer")}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Transfer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Kas List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rekening Kas</Text>
          {cashAccounts.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada kas tunai</Text>
          ) : (
            cashAccounts.map((acc: any) => (
              <View key={acc.id} style={styles.accountCard}>
                <View style={[styles.iconWrap, { backgroundColor: C.successBg }]}>
                  <Ionicons name="wallet" size={20} color={C.success} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountCode}>{acc.code}</Text>
                </View>
                <View style={styles.accountBalanceWrap}>
                  <Text style={styles.balanceLabel}>Saldo</Text>
                  <Text style={styles.accountBalance}>{formatRp(acc.currentBalance)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bank List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rekening Bank</Text>
          {bankAccounts.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada rekening bank</Text>
          ) : (
            bankAccounts.map((acc: any) => (
              <View key={acc.id} style={styles.accountCard}>
                <View style={[styles.iconWrap, { backgroundColor: C.infoBg }]}>
                  <Ionicons name="card" size={20} color={C.info} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{acc.name}</Text>
                  <Text style={styles.accountCode}>{acc.bankName} • {acc.accountNumber}</Text>
                </View>
                <View style={styles.accountBalanceWrap}>
                  <Text style={styles.balanceLabel}>Saldo</Text>
                  <Text style={styles.accountBalance}>{formatRp(acc.currentBalance)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Latest Transactions */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>5 Transaksi Terakhir</Text>
          {latestTx.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada transaksi kas/bank</Text>
          ) : (
            <View style={styles.txBox}>
              {latestTx.map((tx: any, idx: number) => {
                const isIn = tx.type === "in";
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      idx !== latestTx.length - 1 && styles.borderBottom
                    ]}
                  >
                    <View style={styles.txIcon}>
                      <Ionicons
                        name={isIn ? "arrow-down-circle" : "arrow-up-circle"}
                        size={24}
                        color={isIn ? C.success : C.warning}
                      />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {tx.description || tx.transactionNo}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.transactionDate).toLocaleDateString("id-ID")} • {tx.account?.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isIn ? C.success : C.warning },
                      ]}
                    >
                      {isIn ? "+" : "-"}{formatRp(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  summaryLabel: { fontSize: 13, color: C.mutedForeground, marginTop: 12, fontWeight: "500" },
  summaryValue: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  summaryCardFull: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  summaryLabelFull: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  summaryValueFull: { fontSize: 24, fontWeight: "bold", color: "#FFF", letterSpacing: 0.5 },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: C.foreground, marginBottom: 12 },
  emptyText: { fontSize: 14, color: C.mutedForeground, fontStyle: "italic", marginLeft: 4 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: "700", color: C.primary },
  accountCode: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  accountBalanceWrap: { alignItems: "flex-end" },
  balanceLabel: { fontSize: 11, color: C.mutedForeground, marginBottom: 2 },
  accountBalance: { fontSize: 15, fontWeight: "bold", color: C.foreground },
  txBox: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: C.border },
  txIcon: { marginRight: 12 },
  txInfo: { flex: 1, marginRight: 8 },
  txDesc: { fontSize: 14, fontWeight: "600", color: C.foreground },
  txDate: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
  txAmount: { fontSize: 14, fontWeight: "bold" },
});
