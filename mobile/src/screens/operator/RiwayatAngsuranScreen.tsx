import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import C from "../../lib/colors";
import api from "../../lib/api";
import { formatRp, formatDate } from "../../lib/constants";

export default function RiwayatAngsuranScreen({ navigation }: any) {
  const route = useRoute<any>();
  const loanId = route.params?.loanId;
  const loanNo = route.params?.loanNo || `#${loanId}`;

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/mobile/loan-payments", { params: { loanId } });
      setPayments(res.data?.data || []);
    } catch (e) {
      console.warn("Error fetching payments:", e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPayments(); }, []));

  const confirmVoid = (p: any) => { setVoidTarget(p); setReason(""); };
  const cancelVoid = () => { setVoidTarget(null); setReason(""); };

  const doVoid = async () => {
    if (!voidTarget) return;
    setSubmitting(true);
    try {
      const res = await api.post("/api/mobile/loan-payment-void", { paymentId: voidTarget.id, reason: reason.trim() || undefined });
      Alert.alert("Berhasil", res.data?.detail || res.data?.message || "Pembayaran dibatalkan");
      cancelVoid();
      fetchPayments();
    } catch (e: any) {
      Alert.alert("Gagal", e?.response?.data?.message || "Gagal membatalkan pembayaran");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700", flex: 1 }}>Riwayat Angsuran</Text>
        <Text style={{ color: "#cbd5e1", fontSize: 12 }}>{loanNo}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {payments.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Belum ada pembayaran</Text>
          </View>
        ) : (
          payments.map((p) => {
            const isVoided = p.status === "voided";
            return (
              <View key={p.id} style={[styles.card, isVoided && { opacity: 0.55 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.foreground }}>{p.paymentNo}</Text>
                  <Text style={[styles.badge, isVoided ? styles.badgeVoid : styles.badgePaid]}>{isVoided ? "VOID" : "Lunas"}</Text>
                </View>
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>
                  {formatDate(p.paymentDate)} · {p.paymentType === "early_settlement" ? "Pelunasan" : "Angsuran"} · {p.allocCount} alokasi
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.primary, marginTop: 6 }}>{formatRp(p.amount)}</Text>
                {!isVoided && (
                  <TouchableOpacity style={styles.voidBtn} onPress={() => confirmVoid(p)}>
                    <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>Batalkan (VOID)</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* VOID confirm modal */}
      <Modal visible={!!voidTarget} transparent animationType="fade" onRequestClose={cancelVoid}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.foreground }}>Batalkan Pembayaran?</Text>
            <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>
              {voidTarget?.paymentNo} · {formatRp(voidTarget?.amount || 0)}. Reversal: schedule, kas/bank, alokasi, counter loan.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Alasan (opsional)"
              value={reason}
              onChangeText={setReason}
              placeholderTextColor="#94a3b8"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#e2e8f0" }]} onPress={cancelVoid} disabled={submitting}>
                <Text style={{ color: C.foreground, fontWeight: "700" }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: "#DC2626" }]} onPress={doVoid} disabled={submitting}>
                <Text style={{ color: "#FFF", fontWeight: "700" }}>{submitting ? "Memproses..." : "Ya, VOID"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  badge: { fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  badgePaid: { backgroundColor: "#ECFDF5", color: "#059669" },
  badgeVoid: { backgroundColor: "#FEF2F2", color: "#DC2626" },
  voidBtn: { marginTop: 10, backgroundColor: "#DC2626", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { backgroundColor: "#FFF", borderRadius: 14, padding: 18, width: "100%" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 13, color: C.foreground },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
});
