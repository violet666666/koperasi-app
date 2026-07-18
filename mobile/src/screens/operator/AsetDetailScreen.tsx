import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import C from "../../lib/colors";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import api from "../../lib/api";
import { StorageManager } from "../../lib/storage";
import { log } from "../../utils/log";

// operator/admin/admin_sp — the only roles allowed to edit/dispose/delete (matches server gate).
const CAN_MANAGE = (role: string) =>
  role === "operator" || role === "admin" || role === "admin_sp";

const toIsoDate = (d: Date) => {
  // YYYY-MM-DD — matches server's `new Date(disposedDate)` parsing.
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().split("T")[0];
};

export default function AsetDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const { assetId } = route.params || {};

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Role gate (derive once via useMemo, mirroring DashboardScreen) ──────────
  const userRole = useMemo(() => {
    const ud = StorageManager.getFastString("userData");
    if (ud) {
      try {
        const p = JSON.parse(ud);
        return typeof p.role === "object" ? p.role?.name : p.role;
      } catch {
        return "";
      }
    }
    return "";
  }, []);
  const canManage = CAN_MANAGE(userRole);

  // ── Action state ────────────────────────────────────────────────────────────
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [disposedDate, setDisposedDate] = useState<Date>(new Date());
  const [disposedValue, setDisposedValue] = useState("");
  const [showDisposeDatePicker, setShowDisposeDatePicker] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchAssetDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/assets/${assetId}`);
      setAsset(res.data.data);
    } catch (error) {
      log.warn("Error fetching asset details:", error);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useFocusEffect(
    useCallback(() => {
      fetchAssetDetail();
    }, [fetchAssetDetail])
  );

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString("id-ID", { month: "long" })} ${d.getFullYear()}`;
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const onEdit = () => {
    navigation.navigate("AsetForm", { mode: "edit", assetId: asset.id });
  };

  // ── Dispose ─────────────────────────────────────────────────────────────────
  const openDispose = () => {
    setDisposedDate(new Date());
    setDisposedValue("");
    setShowDisposeModal(true);
  };

  const doDispose = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body: Record<string, unknown> = {
        disposedDate: toIsoDate(disposedDate),
      };
      const dv = Number(disposedValue);
      if (disposedValue.trim() !== "" && !isNaN(dv)) {
        body.disposedValue = dv;
      }
      const res = await api.post(
        `/api/mobile/assets/${asset.id}/dispose`,
        body
      );
      if (res.status >= 200 && res.status < 300) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: "success",
          text1: "Disposed",
          text2: "Aset berhasil di-dispose.",
        });
        setShowDisposeModal(false);
        // Refresh detail so the status badge + Disposed badge update in place.
        setLoading(true);
        await fetchAssetDetail();
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.message || err?.message || "Gagal dispose aset.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("AsetDetail: dispose failed", { status: err?.response?.status, msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const doDelete = async () => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.delete(`/api/mobile/assets/${asset.id}`);
      if (res.status >= 200 && res.status < 300) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: "success",
          text1: "Dihapus",
          text2: res.data?.message || "Aset berhasil dihapus.",
        });
        // Back to list — AsetListScreen auto-refreshes via useFocusEffect.
        navigation.goBack();
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.message || err?.message || "Gagal menghapus aset.";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("AsetDetail: delete failed", { status: err?.response?.status, msg });
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
     return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
            <ActivityIndicator size="large" color={C.primary} />
        </View>
     )
  }

  if (!asset) {
     return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
           <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
           <Text style={{ marginTop: 12, color: C.mutedForeground }}>Aset tidak ditemukan</Text>
           <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24, padding: 12, backgroundColor: C.primary, borderRadius: 8 }}>
               <Text style={{ color: "white", fontWeight: "bold" }}>Kembali</Text>
           </TouchableOpacity>
        </View>
     )
  }

  const percentage = asset.acquisitionCost > 0 ? (asset.accumulatedDepreciation / asset.acquisitionCost) * 100 : 0;
  const isDisposed = asset.status === "disposed";

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 60, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Detail Aset</Text>
        </View>
      </View>

      {/* Main Info Card */}
      <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
         <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 }}>
             <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                 <View style={{ flex: 1 }}>
                     <Text style={{ fontSize: 20, fontWeight: "bold", color: C.foreground }}>{asset.name}</Text>
                     <Text style={{ fontSize: 12, color: C.mutedForeground }}>Kode: {asset.code}</Text>
                 </View>
                 {isDisposed ? (
                   <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={{ fontSize: 10, fontWeight: "bold", color: "#DC2626" }}>DISPOSED</Text>
                   </View>
                 ) : (
                   <View style={{ backgroundColor: "#e2e8f0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={{ fontSize: 10, fontWeight: "bold", color: "#475569" }}>{asset.category.toUpperCase()}</Text>
                   </View>
                 )}
             </View>

             <View style={{ height: 1, backgroundColor: "#f1f5f9", marginVertical: 12 }} />

             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Tanggal Beli</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: C.foreground }}>{formatDate(asset.acquisitionDate)}</Text>
             </View>
             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Status</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: isDisposed ? "#F43F5E" : "#10B981" }}>
                     {isDisposed ? "Disposed" : "Aktif Beroperasi"}
                 </Text>
             </View>
             {isDisposed && asset.disposedDate && (
               <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Tanggal Dispose</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: C.foreground }}>{formatDate(asset.disposedDate)}</Text>
               </View>
             )}
             {isDisposed && asset.disposedValue != null && (
               <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Nilai Dispose</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: C.foreground }}>{formatRupiah(asset.disposedValue)}</Text>
               </View>
             )}
             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Lokasi</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: C.foreground }}>{asset.location || "Tidak diatur"}</Text>
             </View>
         </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
         {/* Keuangan Aset */}
         <Text style={{ fontSize: 16, fontWeight: "bold", color: C.primary, marginBottom: 12, marginLeft: 4 }}>
            Kalkulator Historis Nilai
         </Text>

         <View style={{ backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" }}>
             <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", flexDirection: "row", justifyContent: "space-between" }}>
                 <View>
                     <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 4 }}>Harga Perolehan</Text>
                     <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground }}>{formatRupiah(asset.acquisitionCost)}</Text>
                 </View>
                 <View style={{ alignItems: "flex-end" }}>
                     <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 4 }}>Nilai Residu</Text>
                     <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground }}>{formatRupiah(asset.residualValue)}</Text>
                 </View>
             </View>

             <View style={{ padding: 16, backgroundColor: "#f8fafc" }}>
                 <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                     <Text style={{ fontSize: 12, color: C.mutedForeground }}>Akum. Penyusutan ({percentage.toFixed(0)}%)</Text>
                     <Text style={{ fontSize: 14, fontWeight: "bold", color: "#F43F5E" }}>- {formatRupiah(asset.accumulatedDepreciation)}</Text>
                 </View>
                 <View style={{ height: 1, backgroundColor: "#cbd5e1", marginVertical: 8, borderStyle: "dashed", borderWidth: 1, borderColor: "#cbd5e1" }} />
                 <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                     <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>NILAI BUKU BERSIH</Text>
                     <Text style={{ fontSize: 18, fontWeight: "bold", color: "#10B981" }}>{formatRupiah(asset.bookValue)}</Text>
                 </View>
             </View>
         </View>

         {/* Parameter Penyusutan */}
         <Text style={{ fontSize: 16, fontWeight: "bold", color: C.primary, marginBottom: 12, marginLeft: 4 }}>
            Parameter Garis Lurus
         </Text>

         <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" }}>
             <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                 <View style={{ backgroundColor: "#e0f2fe", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                     <Ionicons name="timer-outline" size={20} color="#0284c7" />
                 </View>
                 <View>
                     <Text style={{ fontSize: 12, color: C.mutedForeground }}>Umur Manfaat Ekonomis</Text>
                     <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground }}>{asset.usefulLifeYears} Tahun ({(asset.usefulLifeYears * 12)} Bulan)</Text>
                 </View>
             </View>

             <View style={{ flexDirection: "row", alignItems: "center" }}>
                 <View style={{ backgroundColor: "#fce7f3", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                     <Ionicons name="trending-down-outline" size={20} color="#be185d" />
                 </View>
                 <View>
                     <Text style={{ fontSize: 12, color: C.mutedForeground }}>Prediksi Beban Susut Per Bulan</Text>
                     <Text style={{ fontSize: 16, fontWeight: "bold", color: "#be185d" }}>{formatRupiah(asset.straightLineDepreciationPerMonth)} / bulan</Text>
                 </View>
             </View>
         </View>

         {asset.description && (
            <View style={{ marginTop: 24, padding: 16, backgroundColor: "#f1f5f9", borderRadius: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748b", marginBottom: 8 }}>KETERANGAN ASET</Text>
                <Text style={{ fontSize: 14, color: "#475569", lineHeight: 20 }}>{asset.description}</Text>
            </View>
         )}

         {/* ── Action buttons (operator/admin/admin_sp only) ────────────────────── */}
         {canManage && (
           <View style={{ marginTop: 24, gap: 10 }}>
             {/* Edit — hidden when disposed (matches server's dispose-rejected logic) */}
             {!isDisposed && (
               <TouchableOpacity
                 style={styles.actionBtn}
                 onPress={onEdit}
               >
                 <Ionicons name="create-outline" size={20} color="#FFF" />
                 <Text style={styles.actionBtnText}>Edit Aset</Text>
               </TouchableOpacity>
             )}

             {/* Dispose — hidden when already disposed (badge shown above instead) */}
             {!isDisposed && (
               <TouchableOpacity
                 style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]}
                 onPress={openDispose}
               >
                 <Ionicons name="archive-outline" size={20} color="#FFF" />
                 <Text style={styles.actionBtnText}>Dispose Aset</Text>
               </TouchableOpacity>
             )}

             {/* Delete — always available to managers (soft-delete) */}
             <TouchableOpacity
               style={[styles.actionBtn, { backgroundColor: "#DC2626" }]}
               onPress={() => setShowDeleteConfirm(true)}
             >
               <Ionicons name="trash-outline" size={20} color="#FFF" />
               <Text style={styles.actionBtnText}>Hapus Aset</Text>
             </TouchableOpacity>
           </View>
         )}

         <View style={{ height: 20 }}/>
      </ScrollView>

      {/* ── Dispose Modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={showDisposeModal}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setShowDisposeModal(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dispose Aset?</Text>
            <Text style={styles.modalSubtitle}>
              {asset.code} · {asset.name}. Status akan berubah menjadi Disposed dan tidak bisa diedit lagi.
            </Text>

            <Text style={styles.fieldLabel}>Tanggal Dispose *</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowDisposeDatePicker(true)}
            >
              <Text style={{ color: C.foreground, flex: 1 }}>
                {disposedDate.toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={C.mutedForeground} />
            </TouchableOpacity>
            {showDisposeDatePicker && (
              <DateTimePicker
                value={disposedDate}
                mode="date"
                display="default"
                onChange={(_e, date) => {
                  setShowDisposeDatePicker(false);
                  if (date) setDisposedDate(date);
                }}
              />
            )}

            <Text style={styles.fieldLabel}>Nilai Dispose (Rp) — opsional</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={disposedValue}
              onChangeText={setDisposedValue}
              placeholder="0"
              placeholderTextColor="#94a3b8"
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#e2e8f0" }]}
                onPress={() => setShowDisposeModal(false)}
                disabled={submitting}
              >
                <Text style={{ color: C.foreground, fontWeight: "700" }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#7C3AED" }]}
                onPress={doDispose}
                disabled={submitting}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  {submitting ? "Memproses..." : "Ya, Dispose"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setShowDeleteConfirm(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hapus Aset?</Text>
            <Text style={styles.modalSubtitle}>
              Yakin hapus aset ini? Soft-delete, tidak bisa diundo.
            </Text>
            <Text style={[styles.modalSubtitle, { marginTop: 8, fontWeight: "600", color: C.foreground }]}>
              {asset.code} · {asset.name}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#e2e8f0" }]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={submitting}
              >
                <Text style={{ color: C.foreground, fontWeight: "700" }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#DC2626" }]}
                onPress={doDelete}
                disabled={submitting}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  {submitting ? "Memproses..." : "Ya, Hapus"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 18,
    width: "100%",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.foreground },
  modalSubtitle: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.foreground,
    marginTop: 14,
    marginBottom: 6,
  },
  selectorBtn: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.foreground,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
