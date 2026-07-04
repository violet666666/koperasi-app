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
import { useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import api from "../../lib/api";
import C from "../../lib/colors";
import { log } from "../../utils/log";

// ── Loan shape returned by GET /api/mobile/loans/[id] (pre-fill contract) ──────
// Decimal fields are Number-converted server-side (route.ts lines 72-78).
interface LoanDetail {
  id: number;
  loanNo: string;
  status: string;
  principalAmount: number;
  tenorMonths: number;
  interestRate: number;
  principalPaid: number;
  interestPaid: number;
  disbursementDate: string | null;
  firstDueDate: string | null;
}

// ── PUT body — 7 editable fields, all optional ────────────────────────────────
interface LoanEditBody {
  principalAmount?: number;
  tenorMonths?: number;
  interestRate?: number;
  principalPaid?: number;
  interestPaid?: number;
  disbursementDate?: string;
  firstDueDate?: string;
}

const formatRp = (n: number) =>
  "Rp " + (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });

// YYYY-MM-DD — matches server's `new Date(...)` parsing.
const toIsoDate = (d: Date) => {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().split("T")[0];
};

export default function LoanEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { loanId } = (route.params || {}) as { loanId: number };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fetched snapshot — used for change-detection (7 editable fields).
  const [original, setOriginal] = useState<LoanDetail | null>(null);

  // ── The 7 editable form fields ─────────────────────────────────────────────
  // Numeric inputs are held as strings (TextInput-friendly) and parsed on submit.
  const [principalAmount, setPrincipalAmount] = useState("");
  const [tenorMonths, setTenorMonths] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [principalPaid, setPrincipalPaid] = useState("");
  const [interestPaid, setInterestPaid] = useState("");
  const [disbursementDate, setDisbursementDate] = useState<Date>(new Date());
  const [firstDueDate, setFirstDueDate] = useState<Date>(new Date());

  // Pickers
  const [showDisbursementPicker, setShowDisbursementPicker] = useState(false);
  const [showFirstDuePicker, setShowFirstDuePicker] = useState(false);

  // ── Pre-fill (GET on mount) ────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    if (!loanId) return;
    try {
      const res = await api.get(`/api/mobile/loans/${loanId}`);
      const loan: LoanDetail | undefined = res.data?.data;
      if (loan) {
        setOriginal(loan);
        setPrincipalAmount(String(loan.principalAmount));
        setTenorMonths(String(loan.tenorMonths));
        setInterestRate(String(loan.interestRate));
        setPrincipalPaid(String(loan.principalPaid));
        setInterestPaid(String(loan.interestPaid));
        setDisbursementDate(
          loan.disbursementDate ? new Date(loan.disbursementDate) : new Date(),
        );
        setFirstDueDate(
          loan.firstDueDate ? new Date(loan.firstDueDate) : new Date(),
        );
      } else {
        Toast.show({
          type: "error",
          text1: "Tidak Ditemukan",
          text2: "Pinjaman tidak ditemukan.",
        });
        navigation.goBack();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Gagal memuat detail pinjaman.";
      log.warn("LoanEdit: failed to load loan detail", { status, msg });
      Toast.show({ type: "error", text1: "Gagal Memuat", text2: msg });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [loanId, navigation]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // ── Change-detection (client-side): disable Submit when nothing changed ────
  // 7 inline comparisons vs the fetched snapshot. We intentionally do NOT import
  // the server's buildEditPayload (RN cannot bundle src/lib).
  const hasChanges = (() => {
    if (!original) return false;
    const numPrincipal = Number(principalAmount);
    const numTenor = Number(tenorMonths);
    const numRate = Number(interestRate);
    const numPrincipalPaid = Number(principalPaid);
    const numInterestPaid = Number(interestPaid);
    if (numPrincipal !== original.principalAmount) return true;
    if (numTenor !== original.tenorMonths) return true;
    if (numRate !== original.interestRate) return true;
    if (numPrincipalPaid !== original.principalPaid) return true;
    if (numInterestPaid !== original.interestPaid) return true;
    if (toIsoDate(disbursementDate) !== (original.disbursementDate || "").slice(0, 10))
      return true;
    if (toIsoDate(firstDueDate) !== (original.firstDueDate || "").slice(0, 10))
      return true;
    return false;
  })();

  // ── Basic numeric validity (client-side guard; server re-validates) ────────
  const principalValid =
    principalAmount !== "" && !isNaN(Number(principalAmount)) && Number(principalAmount) > 0;
  const tenorValid =
    tenorMonths !== "" &&
    !isNaN(Number(tenorMonths)) &&
    Number(tenorMonths) > 0 &&
    Number(tenorMonths) <= 120;
  const rateValid =
    interestRate !== "" &&
    !isNaN(Number(interestRate)) &&
    Number(interestRate) >= 0 &&
    Number(interestRate) <= 100;
  const principalPaidValid =
    principalPaid !== "" && !isNaN(Number(principalPaid)) && Number(principalPaid) >= 0;
  const interestPaidValid =
    interestPaid !== "" && !isNaN(Number(interestPaid)) && Number(interestPaid) >= 0;

  const canSubmit =
    !submitting &&
    hasChanges &&
    principalValid &&
    tenorValid &&
    rateValid &&
    principalPaidValid &&
    interestPaidValid;

  // ── Submit (PUT) — no live preview V1; show response monthlyInstallment ────
  const submit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const body: LoanEditBody = {};
      const numPrincipal = Number(principalAmount);
      const numTenor = Number(tenorMonths);
      const numRate = Number(interestRate);
      const numPrincipalPaid = Number(principalPaid);
      const numInterestPaid = Number(interestPaid);
      const isoDisb = toIsoDate(disbursementDate);
      const isoFirstDue = toIsoDate(firstDueDate);

      if (numPrincipal !== original!.principalAmount)
        body.principalAmount = numPrincipal;
      if (numTenor !== original!.tenorMonths) body.tenorMonths = numTenor;
      if (numRate !== original!.interestRate) body.interestRate = numRate;
      if (numPrincipalPaid !== original!.principalPaid)
        body.principalPaid = numPrincipalPaid;
      if (numInterestPaid !== original!.interestPaid)
        body.interestPaid = numInterestPaid;
      if (isoDisb !== (original!.disbursementDate || "").slice(0, 10))
        body.disbursementDate = isoDisb;
      if (isoFirstDue !== (original!.firstDueDate || "").slice(0, 10))
        body.firstDueDate = isoFirstDue;

      const res = await api.put(`/api/mobile/loans/${loanId}`, body);
      if (res.status >= 200 && res.status < 300) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const monthlyInstallment = res.data?.data?.monthlyInstallment;
        const changes: string[] | undefined = res.data?.changes;
        const changesSummary =
          changes && changes.length > 0
            ? changes.join("\n")
            : "Tidak ada perubahan.";
        const monthlyLine = Number.isFinite(monthlyInstallment)
          ? `\nCicilan baru: ${formatRp(Number(monthlyInstallment))}/bln`
          : "";
        Toast.show({
          type: "success",
          text1: "Tersimpan",
          text2: `Pinjaman berhasil di-edit.${monthlyLine}`,
        });
        log.log("LoanEdit: success", {
          loanId,
          changes,
          monthlyInstallment,
        });
        navigation.goBack();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg =
        data?.message || err?.message || "Gagal mengedit pinjaman.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("LoanEdit: submit failed", { status, msg });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

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
        <Text style={styles.headerTitle}>Edit Pinjaman</Text>
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
          ) : original ? (
            <>
              {/* Loan identity (read-only context) */}
              <View style={styles.loanIdRow}>
                <Text style={styles.loanNoText}>{original.loanNo}</Text>
                <Text style={styles.statusText}>Status: {original.status}</Text>
              </View>

              {/* Principal Amount */}
              <Text style={styles.label}>Pokok Pinjaman (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={principalAmount}
                onChangeText={setPrincipalAmount}
                placeholder="Contoh: 5000000"
              />
              {principalAmount !== "" &&
                !isNaN(Number(principalAmount)) &&
                Number(principalAmount) > 0 && (
                  <Text style={styles.hint}>{formatRp(Number(principalAmount))}</Text>
                )}

              {/* Tenor */}
              <Text style={styles.label}>Tenor (Bulan) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={tenorMonths}
                onChangeText={setTenorMonths}
                placeholder="Contoh: 12"
              />

              {/* Interest Rate */}
              <Text style={styles.label}>Suku Bunga (% / tahun) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Contoh: 1"
              />

              {/* Principal Paid */}
              <Text style={styles.label}>Pokok Terbayar (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={principalPaid}
                onChangeText={setPrincipalPaid}
                placeholder="Contoh: 1000000"
              />
              {principalPaid !== "" &&
                !isNaN(Number(principalPaid)) &&
                Number(principalPaid) >= 0 && (
                  <Text style={styles.hint}>{formatRp(Number(principalPaid))}</Text>
                )}

              {/* Interest Paid */}
              <Text style={styles.label}>Bunga Terbayar (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={interestPaid}
                onChangeText={setInterestPaid}
                placeholder="Contoh: 500000"
              />
              {interestPaid !== "" &&
                !isNaN(Number(interestPaid)) &&
                Number(interestPaid) >= 0 && (
                  <Text style={styles.hint}>{formatRp(Number(interestPaid))}</Text>
                )}

              {/* Disbursement Date */}
              <Text style={styles.label}>Tanggal Cair *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowDisbursementPicker(true)}
              >
                <Text style={{ color: C.foreground, flex: 1 }}>
                  {fmtDate(disbursementDate)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={C.mutedForeground} />
              </TouchableOpacity>
              {showDisbursementPicker && (
                <DateTimePicker
                  value={disbursementDate}
                  mode="date"
                  display="default"
                  onChange={(_e, date) => {
                    setShowDisbursementPicker(Platform.OS === "ios");
                    if (date) setDisbursementDate(date);
                  }}
                />
              )}

              {/* First Due Date */}
              <Text style={styles.label}>Jatuh Tempo Pertama *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowFirstDuePicker(true)}
              >
                <Text style={{ color: C.foreground, flex: 1 }}>
                  {fmtDate(firstDueDate)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={C.mutedForeground} />
              </TouchableOpacity>
              {showFirstDuePicker && (
                <DateTimePicker
                  value={firstDueDate}
                  mode="date"
                  display="default"
                  onChange={(_e, date) => {
                    setShowFirstDuePicker(Platform.OS === "ios");
                    if (date) setFirstDueDate(date);
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
                  <Ionicons name="save-outline" size={20} color="#FFF" />
                )}
                <Text style={styles.submitText}>
                  {submitting
                    ? "Memproses..."
                    : hasChanges
                      ? "Simpan Perubahan"
                      : "Tidak Ada Perubahan"}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 60 }} />
            </>
          ) : null}
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
  loanIdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  loanNoText: { fontSize: 13, fontWeight: "700", color: C.primary },
  statusText: { fontSize: 12, color: C.mutedForeground },
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
  hint: { fontSize: 12, color: C.mutedForeground, marginTop: 4, marginLeft: 4 },
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
});
