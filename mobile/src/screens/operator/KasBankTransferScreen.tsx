import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import api from "../../lib/api";
import C from "../../lib/colors";
import { log } from "../../utils/log";

// ── Types ──────────────────────────────────────────────────────────────────
interface Account {
  id: number;
  code: string;
  name: string;
  type: "cash" | "bank";
  bankName?: string | null;
  accountNumber?: string | null;
  currentBalance: number;
}

const formatRp = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function KasBankTransferScreen() {
  const navigation = useNavigation<any>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get("/api/mobile/kas-bank");
      const list: Account[] = res.data?.data?.accounts || [];
      setAccounts(list);
      if (list.length > 0 && fromId === null) setFromId(list[0].id);
      if (list.length > 1 && toId === null) {
        const other = list.find((a) => a.id !== list[0].id);
        if (other) setToId(other.id);
      }
    } catch (err) {
      log.error("KasBankTransfer: failed to load accounts", err);
      Toast.show({
        type: "error",
        text1: "Gagal Memuat",
        text2: "Tidak dapat memuat daftar akun kas/bank.",
      });
    } finally {
      setLoading(false);
    }
  }, [fromId, toId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // If the from-account changes and matches the to-account, reset to-account.
  useEffect(() => {
    if (fromId !== null && fromId === toId) {
      const other = accounts.find((a) => a.id !== fromId);
      setToId(other ? other.id : null);
    }
  }, [fromId, toId, accounts]);

  const fromAccount = accounts.find((a) => a.id === fromId) || null;
  const toAccount = accounts.find((a) => a.id === toId) || null;
  // Exclude the selected from-account from the to-picker.
  const toOptions = accounts.filter((a) => a.id !== fromId);

  const canSubmit =
    fromId !== null &&
    toId !== null &&
    fromId !== toId &&
    !submitting &&
    amount !== "" &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0;

  const accountLabel = (acc: Account | null) => {
    if (!acc) return "Pilih akun...";
    return `${acc.type === "cash" ? "💵" : "🏦"} ${acc.name}`;
  };

  const submit = async () => {
    if (fromId === null || toId === null) {
      Toast.show({
        type: "error",
        text1: "Lengkapi Akun",
        text2: "Pilih akun asal dan tujuan.",
      });
      return;
    }
    if (fromId === toId) {
      Toast.show({
        type: "error",
        text1: "Akun Sama",
        text2: "Akun asal dan tujuan tidak boleh sama.",
      });
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      Toast.show({
        type: "error",
        text1: "Nominal Tidak Valid",
        text2: "Masukkan nominal lebih dari 0.",
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const body = {
        fromAccountId: fromId,
        toAccountId: toId,
        amount: amountNum,
        description: description.trim() || undefined,
        transactionDate: txDate.toISOString(),
      };

      const res = await api.post("/api/mobile/kas-bank/transfers", body);
      if (res.status === 201) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: "success",
          text1: "Transfer Berhasil",
          text2: "Dana telah dipindahkan antar akun.",
        });
        navigation.goBack();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg =
        data?.message ||
        err?.message ||
        "Gagal memproses transfer.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("KasBankTransfer: submit failed", { status, msg });
    } finally {
      setSubmitting(false);
    }
  };

  const renderPicker = (
    list: Account[],
    selectedId: number | null,
    onSelect: (id: number) => void,
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => {
    if (!open) return null;
    if (list.length === 0) {
      return (
        <View style={styles.pickerBox}>
          <Text style={[styles.pickerTitle, { padding: 16 }]}>
            Tidak ada akun lain tersedia.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.pickerBox}>
        {list.map((acc) => (
          <TouchableOpacity
            key={acc.id}
            style={[
              styles.pickerRow,
              selectedId === acc.id && styles.pickerRowActive,
            ]}
            onPress={() => {
              onSelect(acc.id);
              setOpen(false);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerTitle}>
                {acc.type === "cash" ? "💵" : "🏦"} {acc.name}
              </Text>
              <Text style={styles.pickerSub}>
                {acc.code} • {formatRp(acc.currentBalance)}
              </Text>
            </View>
            {selectedId === acc.id && (
              <Ionicons name="checkmark-circle" size={20} color={C.info} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Transfer Antar Kas/Bank</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          ) : accounts.length < 2 ? (
            <Text style={styles.emptyText}>
              Dibutuhkan minimal 2 akun kas/bank untuk melakukan transfer.
            </Text>
          ) : (
            <>
              {/* From Account */}
              <Text style={styles.label}>Dari Akun *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => {
                  setShowFromPicker((v) => !v);
                  setShowToPicker(false);
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: fromAccount ? C.foreground : C.mutedForeground,
                  }}
                  numberOfLines={1}
                >
                  {accountLabel(fromAccount)}
                </Text>
                <Ionicons
                  name={showFromPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.mutedForeground}
                />
              </TouchableOpacity>
              {fromAccount && (
                <Text style={styles.balanceHint}>
                  Saldo: {formatRp(fromAccount.currentBalance)}
                </Text>
              )}
              {renderPicker(
                accounts,
                fromId,
                setFromId,
                showFromPicker,
                setShowFromPicker,
              )}

              {/* Swap icon */}
              <View style={styles.swapRow}>
                <Ionicons name="arrow-down" size={20} color={C.mutedForeground} />
              </View>

              {/* To Account */}
              <Text style={styles.label}>Ke Akun *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => {
                  setShowToPicker((v) => !v);
                  setShowFromPicker(false);
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: toAccount ? C.foreground : C.mutedForeground,
                  }}
                  numberOfLines={1}
                >
                  {accountLabel(toAccount)}
                </Text>
                <Ionicons
                  name={showToPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.mutedForeground}
                />
              </TouchableOpacity>
              {toAccount && (
                <Text style={styles.balanceHint}>
                  Saldo: {formatRp(toAccount.currentBalance)}
                </Text>
              )}
              {renderPicker(
                toOptions,
                toId,
                setToId,
                showToPicker,
                setShowToPicker,
              )}

              {/* Amount */}
              <Text style={styles.label}>Nominal (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="Contoh: 500000"
              />
              {amount !== "" && !isNaN(Number(amount)) && (
                <Text style={styles.balanceHint}>
                  = {formatRp(Number(amount))}
                </Text>
              )}

              {/* Description */}
              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Catatan singkat (opsional)"
                multiline
              />

              {/* Date */}
              <Text style={styles.label}>Tanggal Transfer</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: C.foreground, flex: 1 }}>
                  {txDate.toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={C.mutedForeground} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={txDate}
                  mode="date"
                  display="default"
                  onChange={(_e, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) setTxDate(date);
                  }}
                />
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
                onPress={submit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                )}
                <Text style={styles.submitText}>
                  {submitting ? "Memproses..." : "Kirim Transfer"}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 60 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: { color: "#FFF", fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  form: { padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: C.foreground,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.foreground,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectorBtn: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
  },
  balanceHint: {
    fontSize: 12,
    color: C.mutedForeground,
    marginTop: 4,
    marginLeft: 4,
  },
  swapRow: { alignItems: "center", marginVertical: 4 },
  pickerBox: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  pickerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerRowActive: { backgroundColor: C.infoBg },
  pickerTitle: { fontSize: 14, fontWeight: "600", color: C.foreground },
  pickerSub: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  emptyText: {
    fontSize: 14,
    color: C.mutedForeground,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 40,
  },
});
