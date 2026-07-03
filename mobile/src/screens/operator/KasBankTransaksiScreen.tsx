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

type TxType = "in" | "out";

interface CategoryDef {
  key: string;
  label: string;
  type: TxType | "both";
}

// CASH_BANK_CATEGORIES mirrored from src/lib/constants/index.ts (server-side,
// NOT importable into RN). Filter by type === formData.type || "both".
const CATEGORIES: CategoryDef[] = [
  { key: "simpanan_pokok", label: "Simpanan Pokok", type: "in" },
  { key: "simpanan_wajib", label: "Simpanan Wajib", type: "in" },
  { key: "simpanan_sukarela", label: "Simpanan Sukarela", type: "in" },
  { key: "angsuran_pokok", label: "Angsuran Pokok", type: "in" },
  { key: "jasa_pinjaman", label: "Jasa/Bunga Pinjaman", type: "in" },
  { key: "pendapatan_unit", label: "Pendapatan Unit Usaha", type: "in" },
  { key: "pencairan_pinjaman", label: "Pencairan Pinjaman", type: "out" },
  { key: "biaya_operasional", label: "Biaya Operasional", type: "out" },
  { key: "beban_unit", label: "Beban Operasional Unit", type: "out" },
  { key: "hpp_toko", label: "HPP / Pembelian Barang", type: "out" },
  { key: "hutang_mitra", label: "Kewajiban Bagi Hasil Mitra", type: "out" },
  { key: "transfer", label: "Transfer Antar Kas/Bank", type: "both" },
  { key: "lainnya", label: "Lain-lain", type: "both" },
];

const NONE_CATEGORY = "none";

const formatRp = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const todayIso = () => new Date().toISOString();

export default function KasBankTransaksiScreen() {
  const navigation = useNavigation<any>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [accountId, setAccountId] = useState<number | null>(null);
  const [type, setType] = useState<TxType>("in");
  const [category, setCategory] = useState<string>(NONE_CATEGORY);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Miscat confirm flow (server-side guard).
  const [miscatPrompt, setMiscatPrompt] = useState<{
    message: string;
    suggestedCategory: string;
  } | null>(null);
  const [miscatReason, setMiscatReason] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get("/api/mobile/kas-bank");
      const list: Account[] = res.data?.data?.accounts || [];
      setAccounts(list);
      if (list.length > 0 && accountId === null) {
        setAccountId(list[0].id);
      }
    } catch (err) {
      log.error("KasBankTransaksi: failed to load accounts", err);
      Toast.show({
        type: "error",
        text1: "Gagal Memuat",
        text2: "Tidak dapat memuat daftar akun kas/bank.",
      });
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // When type changes, reset category if the current one no longer applies.
  useEffect(() => {
    if (category === NONE_CATEGORY) return;
    const def = CATEGORIES.find((c) => c.key === category);
    if (!def) {
      setCategory(NONE_CATEGORY);
      return;
    }
    if (def.type !== type && def.type !== "both") {
      setCategory(NONE_CATEGORY);
    }
  }, [type, category]);

  const selectedAccount = accounts.find((a) => a.id === accountId) || null;

  const filteredCategories = CATEGORIES.filter(
    (c) => c.type === type || c.type === "both",
  );

  const categoryLabel = (key: string) => {
    if (key === NONE_CATEGORY) return "Tanpa Kategori";
    return CATEGORIES.find((c) => c.key === key)?.label || key;
  };

  const canSubmit =
    !!accountId &&
    !submitting &&
    amount !== "" &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0 &&
    (!miscatPrompt || miscatReason.trim().length >= 3);

  const submit = async () => {
    if (!accountId) {
      Toast.show({ type: "error", text1: "Pilih Akun", text2: "Pilih akun kas/bank terlebih dahulu." });
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      Toast.show({ type: "error", text1: "Nominal Tidak Valid", text2: "Masukkan nominal lebih dari 0." });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        accountId,
        type,
        category: category === NONE_CATEGORY ? undefined : category,
        amount: amountNum,
        description: description.trim() || undefined,
        transactionDate: txDate.toISOString(),
      };
      if (miscatPrompt) {
        body.confirmMiscat = true;
        body.miscatReason = miscatReason.trim();
      }

      const res = await api.post("/api/mobile/kas-bank/transactions", body);
      if (res.status === 201) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: "success",
          text1: "Tercatat",
          text2: "Transaksi kas/bank berhasil disimpan.",
        });
        navigation.goBack();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      // Miscat guard — show confirm UI (do NOT auto-resubmit).
      if (status === 400 && data?.requiresConfirm) {
        setMiscatPrompt({
          message: data.message || "Kategori tampaknya tidak sesuai.",
          suggestedCategory: data.suggestedCategory || "",
        });
        setMiscatReason("");
        setSubmitting(false);
        return;
      }

      const msg =
        data?.message ||
        err?.message ||
        "Gagal menyimpan transaksi.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("KasBankTransaksi: submit failed", { status, msg });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMiscat = () => {
    setMiscatPrompt(null);
    setMiscatReason("");
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
        <Text style={styles.headerTitle}>Catat Transaksi Kas/Bank</Text>
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
          ) : accounts.length === 0 ? (
            <Text style={styles.emptyText}>
              Tidak ada akun kas/bank aktif pada scope anda.
            </Text>
          ) : (
            <>
              {/* Account Picker */}
              <Text style={styles.label}>Akun Kas/Bank *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowAccountPicker((v) => !v)}
              >
                <Text
                  style={{
                    flex: 1,
                    color: selectedAccount ? C.foreground : C.mutedForeground,
                  }}
                  numberOfLines={1}
                >
                  {selectedAccount
                    ? `${selectedAccount.type === "cash" ? "💵" : "🏦"} ${selectedAccount.name}`
                    : "Pilih akun..."}
                </Text>
                <Ionicons
                  name={showAccountPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.mutedForeground}
                />
              </TouchableOpacity>
              {selectedAccount && (
                <Text style={styles.balanceHint}>
                  Saldo: {formatRp(selectedAccount.currentBalance)}
                </Text>
              )}
              {showAccountPicker && (
                <View style={styles.pickerBox}>
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.pickerRow,
                        accountId === acc.id && styles.pickerRowActive,
                      ]}
                      onPress={() => {
                        setAccountId(acc.id);
                        setShowAccountPicker(false);
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
                      {accountId === acc.id && (
                        <Ionicons name="checkmark-circle" size={20} color={C.info} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Type Toggle */}
              <Text style={styles.label}>Jenis Transaksi *</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    type === "in" && styles.toggleInActive,
                  ]}
                  onPress={() => setType("in")}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={18}
                    color={type === "in" ? "#FFF" : C.success}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      type === "in" && styles.toggleTextActive,
                    ]}
                  >
                    Masuk
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    type === "out" && styles.toggleOutActive,
                  ]}
                  onPress={() => setType("out")}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={18}
                    color={type === "out" ? "#FFF" : C.warning}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      type === "out" && styles.toggleTextActive,
                    ]}
                  >
                    Keluar
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Category Picker */}
              <Text style={styles.label}>Kategori</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowCategoryPicker((v) => !v)}
              >
                <Text
                  style={{
                    flex: 1,
                    color: C.foreground,
                  }}
                >
                  {categoryLabel(category)}
                </Text>
                <Ionicons
                  name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.mutedForeground}
                />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.pickerBox}>
                  <TouchableOpacity
                    style={[
                      styles.pickerRow,
                      category === NONE_CATEGORY && styles.pickerRowActive,
                    ]}
                    onPress={() => {
                      setCategory(NONE_CATEGORY);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerTitle}>Tanpa Kategori</Text>
                    {category === NONE_CATEGORY && (
                      <Ionicons name="checkmark-circle" size={20} color={C.info} />
                    )}
                  </TouchableOpacity>
                  {filteredCategories.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      style={[
                        styles.pickerRow,
                        category === c.key && styles.pickerRowActive,
                      ]}
                      onPress={() => {
                        setCategory(c.key);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text style={styles.pickerTitle}>{c.label}</Text>
                      {category === c.key && (
                        <Ionicons name="checkmark-circle" size={20} color={C.info} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
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
              <Text style={styles.label}>Tanggal Transaksi</Text>
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

              {/* Miscat Confirm UI */}
              {miscatPrompt && (
                <View style={styles.miscatBox}>
                  <View style={styles.miscatHeader}>
                    <Ionicons name="warning-outline" size={20} color={C.warning} />
                    <Text style={styles.miscatTitle}>Peringatan Kategori</Text>
                  </View>
                  <Text style={styles.miscatMsg}>{miscatPrompt.message}</Text>
                  {miscatPrompt.suggestedCategory ? (
                    <Text style={styles.miscatSuggest}>
                      Saran kategori: {categoryLabel(miscatPrompt.suggestedCategory)}
                    </Text>
                  ) : null}
                  <Text style={styles.label}>
                    Alasan tetap mencatat (min. 3 karakter) *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={miscatReason}
                    onChangeText={setMiscatReason}
                    placeholder="Tulis alasan..."
                  />
                  <View style={styles.miscatActions}>
                    <TouchableOpacity
                      style={[styles.miscatBtn, styles.miscatCancelBtn]}
                      onPress={cancelMiscat}
                    >
                      <Text style={styles.miscatCancelText}>Batal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                  <Ionicons name="save-outline" size={20} color="#FFF" />
                )}
                <Text style={styles.submitText}>
                  {submitting
                    ? "Memproses..."
                    : miscatPrompt
                      ? "Tetap Catat"
                      : "Simpan Transaksi"}
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
  toggleRow: { flexDirection: "row", gap: 12 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  toggleInActive: { backgroundColor: C.success, borderColor: C.success },
  toggleOutActive: { backgroundColor: C.warning, borderColor: C.warning },
  toggleText: { fontSize: 15, fontWeight: "700", color: C.foreground },
  toggleTextActive: { color: "#FFF" },
  miscatBox: {
    backgroundColor: C.warningBg,
    borderWidth: 1,
    borderColor: C.warning,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  miscatHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  miscatTitle: { fontSize: 15, fontWeight: "700", color: C.warning },
  miscatMsg: { fontSize: 13, color: C.foreground, marginBottom: 6 },
  miscatSuggest: { fontSize: 13, color: C.mutedForeground, marginBottom: 8 },
  miscatActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  miscatBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  miscatCancelBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  miscatCancelText: { color: C.foreground, fontWeight: "600" },
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
