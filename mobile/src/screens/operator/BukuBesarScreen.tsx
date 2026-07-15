import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import C from "../../lib/colors";
import api from "../../lib/api";
import { log } from "../../utils/log";

type Account = {
  id: number;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
};

type LedgerLine = {
  id: number;
  date: string;
  journalNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  isAdjustment: boolean;
};

export default function BukuBesarScreen({ navigation }: any) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerLine[]>([]);
  const [endingBalance, setEndingBalance] = useState<number>(0);
  const [selectedAccountData, setSelectedAccountData] = useState<Account | null>(null);

  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedger(selectedAccountId);
    } else {
      setLedger([]);
      setEndingBalance(0);
      setSelectedAccountData(null);
    }
  }, [selectedAccountId]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/api/mobile/accounts?isDetail=true");
      setAccounts(res.data.data || []);
    } catch (error) {
      log.warn("Error fetching accounts:", error);
    } finally {
      setLoadingAcc(false);
    }
  };

  const fetchLedger = async (accId: number) => {
    setLoadingLedger(true);
    try {
      const res = await api.get(`/api/mobile/ledger?accountId=${accId}`);
      const d = res.data?.data;
      setLedger(d?.ledger ?? []);
      setEndingBalance(d?.endingBalance ?? 0);
      setSelectedAccountData(d?.account ?? null);
    } catch (error) {
      log.warn("Error fetching ledger:", error);
    } finally {
      setLoadingLedger(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Math.abs(num)); // Show abs value for table
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  const renderItem = ({ item }: { item: LedgerLine }) => (
    <View style={styles.tableRow}>
      <View style={[styles.cell, { flex: 2 }]}>
        <Text style={styles.cellText}>{formatDate(item.date)}</Text>
        <Text style={[styles.cellText, { fontSize: 10, color: C.mutedForeground }]}>{item.journalNo}</Text>
      </View>
      <Text style={[styles.cell, styles.cellText, { flex: 3 }]} numberOfLines={2}>
        {item.description}
      </Text>
      <Text style={[styles.cell, styles.cellText, styles.numberCell, { flex: 2, color: "#10B981" }]}>
        {item.debit > 0 ? formatRupiah(item.debit) : "-"}
      </Text>
      <Text style={[styles.cell, styles.cellText, styles.numberCell, { flex: 2, color: "#F43F5E" }]}>
        {item.credit > 0 ? formatRupiah(item.credit) : "-"}
      </Text>
      <Text style={[styles.cell, styles.cellText, styles.numberCell, { flex: 2, fontWeight: "bold" }]}>
        {formatRupiah(item.balance)} 
        {item.balance < 0 ? " (Min)" : ""}
      </Text>
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
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Buku Besar</Text>
        </View>
      </View>

      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: C.foreground, marginBottom: 8 }}>
          Pilih Akun Rekening
        </Text>
        <View style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, backgroundColor: "white", marginBottom: 16 }}>
          {loadingAcc ? (
            <ActivityIndicator size="small" color={C.primary} style={{ margin: 16 }} />
          ) : (
            <Picker
              selectedValue={selectedAccountId}
              onValueChange={(val: any) => setSelectedAccountId(val)}
              style={{ height: 50 }}
            >
              <Picker.Item label="-- Pilih Akun --" value={null} color={C.mutedForeground} />
              {accounts.map(acc => (
                <Picker.Item key={acc.id} label={`${acc.code} - ${acc.name}`} value={acc.id} />
              ))}
            </Picker>
          )}
        </View>

        {selectedAccountData && (
          <View style={{ backgroundColor: C.primary, padding: 16, borderRadius: 12, marginBottom: 16 }}>
             <Text style={{ color: "#94a3b8", fontSize: 12 }}>Saldo Akhir ({selectedAccountData.normalBalance.toUpperCase()})</Text>
             <Text style={{ color: "white", fontSize: 24, fontWeight: "bold", marginVertical: 4 }}>
                {endingBalance < 0 ? "-" : ""}{formatRupiah(endingBalance)}
             </Text>
             <Text style={{ color: "white", fontSize: 14 }}>
               {selectedAccountData.code} - {selectedAccountData.name}
             </Text>
          </View>
        )}
      </View>

      {/* Ledger Table Section */}
      {loadingLedger ? (
         <View style={{ flex: 1, justifyContent: "center" }}>
             <ActivityIndicator size="large" color={C.primary} />
         </View>
      ) : (
        selectedAccountId ? (
          <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
             <View style={{ width: 680 }}>
                {/* Table Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                   <Text style={[styles.cell, styles.headerText, { flex: 2 }]}>Tanggal</Text>
                   <Text style={[styles.cell, styles.headerText, { flex: 3 }]}>Keterangan</Text>
                   <Text style={[styles.cell, styles.headerText, styles.numberCell, { flex: 2 }]}>Debit</Text>
                   <Text style={[styles.cell, styles.headerText, styles.numberCell, { flex: 2 }]}>Kredit</Text>
                   <Text style={[styles.cell, styles.headerText, styles.numberCell, { flex: 2 }]}>Saldo</Text>
                </View>

                {/* Table Body */}
                {ledger.length > 0 ? (
                  <FlatList
                    data={ledger}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    scrollEnabled={false}
                    windowSize={10}
                    maxToRenderPerBatch={5}
                    initialNumToRender={10}
                    removeClippedSubviews={true}
                  />
                ) : (
                  <View style={{ alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "white", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                      <Text style={{ color: C.mutedForeground }}>Belum ada mutasi pada akun ini.</Text>
                  </View>
                )}
             </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
              <Ionicons name="book-outline" size={64} color="#e2e8f0" />
              <Text style={{ color: C.mutedForeground, marginTop: 16, textAlign: "center" }}>
                  Silakan pilih akun pada dropdown di atas untuk melihat buku besar.
              </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "white",
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  cellText: {
    fontSize: 12,
    color: C.foreground,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
  },
  numberCell: {
    textAlign: "right",
  },
});
