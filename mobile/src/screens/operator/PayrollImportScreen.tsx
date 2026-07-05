import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import api from "../../lib/api";
import C from "../../lib/colors";
import { log } from "../../utils/log";

/**
 * PayrollImportScreen (Fase 8c T4)
 *
 * 3-step flow mirroring the web gaji import dialog:
 *   1. Pick  — choose Excel/CSV + sourceType (POLRES/POLSEK)
 *   2. Preview — POST mode=preview → summary + first-50-row table (matched/unmatched)
 *   3. Commit  — POST mode=commit → success toast → goBack
 *
 * Calls POST /api/mobile/payroll/import (multipart/form-data). The preview + commit
 * calls use a 5-min per-request timeout (large files / slow parse can exceed the
 * 15s axios default). Operator-only at the API; this screen is reached only via
 * the operator-gated button on GajiPeriodeScreen.
 */

type SourceType = "polres" | "polsek";

interface PreviewRow {
  row: number;
  nrp: string;
  nama: string;
  pangkat: string;
  gajiBersih: number;
  potTajib: number;
  potSP: number;
  potBarang: number;
  totalPotKoperasi: number;
  sisaGaji: number;
  terimaBersih: number;
  memberId: number | null;
  status: string;
}

interface PreviewData {
  sheetName: string;
  periodName: string;
  totalRows: number;
  success: number;
  failed: number;
  preview: PreviewRow[];
}

const IMPORT_TIMEOUT = 300_000; // 5 minutes — large payroll files can take a while

const rupiah = (n: number) => {
  if (!n) return "0";
  return Number(n).toLocaleString("id-ID");
};

function mimeFor(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  return "text/csv";
}

export default function PayrollImportScreen({ navigation }: any) {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("polres");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      setFileUri(file.uri);
      setFileName(file.name);
      setPreview(null);
    } catch (error) {
      log.error("payroll pickFile failed:", error);
      Alert.alert("Gagal", "Aplikasi kesalitan memproses file tersebut.");
    }
  };

  const buildFormData = (mode: "preview" | "commit") => {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      type: mimeFor(fileName || ""),
      name: fileName || "gaji.xlsx",
    } as any);
    formData.append("mode", mode);
    formData.append("sourceType", sourceType);
    return formData;
  };

  const errMsg = (error: any): string =>
    error?.response?.data?.message || error?.message || "Gagal menghubungi server.";

  const doPreview = async () => {
    if (!fileUri) return Alert.alert("Kosong", "Pilih file terlebih dahulu.");
    setLoading(true);
    try {
      const res = await api.post("/api/mobile/payroll/import", buildFormData("preview"), {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: IMPORT_TIMEOUT,
      });
      setPreview(res.data?.data ?? null);
    } catch (error: any) {
      log.error("payroll preview failed:", error);
      Alert.alert("Gagal Pratinjau", errMsg(error));
    } finally {
      setLoading(false);
    }
  };

  const doCommit = async () => {
    if (!fileUri) return;
    setLoading(true);
    try {
      const res = await api.post("/api/mobile/payroll/import", buildFormData("commit"), {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: IMPORT_TIMEOUT,
      });
      const d = res.data?.data;
      Alert.alert(
        "Import Berhasil",
        `Periode ${d?.periodName ?? ""}\n${d?.success ?? 0} anggota diproses, ${d?.failed ?? 0} dilewati.`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      log.error("payroll commit failed:", error);
      Alert.alert("Gagal Import", errMsg(error));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFileUri(null);
    setFileName(null);
    setPreview(null);
  };

  const matched = preview ? preview.preview.filter((p) => p.status === "valid").length : 0;
  const unmatched = preview ? preview.preview.filter((p) => p.status === "no_match").length : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Import Gaji</Text>
          <Text style={styles.headerSub}>Upload file POT GAJI (.xlsx / .csv)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Step 1: source type toggle */}
        <Text style={styles.label}>Jenis Sumber</Text>
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          {(["polres", "polsek"] as SourceType[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => { setSourceType(s); setPreview(null); }}
              style={[styles.sourceBtn, sourceType === s && styles.sourceBtnActive]}
            >
              <Text style={[styles.sourceBtnText, sourceType === s && styles.sourceBtnTextActive]}>
                {s === "polres" ? "POLRES" : "POLSEK"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 2: file picker */}
        <TouchableOpacity
          onPress={pickFile}
          style={[styles.filePicker, { borderColor: fileUri ? "#10B981" : C.primary }]}
        >
          <Ionicons name={fileUri ? "document-text" : "cloud-upload"} size={40} color={fileUri ? "#10B981" : C.primary} />
          <Text style={styles.filePickerTitle}>
            {fileUri ? "Ganti File" : "Pilih File Excel / CSV"}
          </Text>
          {fileName ? <Text style={styles.fileName}>{fileName}</Text> : null}
        </TouchableOpacity>

        {/* Step 3: preview action */}
        {fileUri && !preview && (
          <TouchableOpacity
            onPress={doPreview}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: C.accent }]}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="search" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Pratinjau Data</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Step 4: preview result */}
        {preview && (
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewPeriod}>{preview.periodName}</Text>
              <Text style={styles.previewSheet}>Sheet: {preview.sheetName}</Text>
            </View>

            <View style={styles.statRow}>
              <View style={[styles.statCard, { backgroundColor: "#EFF6FF" }]}>
                <Text style={styles.statLabel}>TOTAL BARIS</Text>
                <Text style={[styles.statValue, { color: "#1E40AF" }]}>{preview.totalRows}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#ECFDF5" }]}>
                <Text style={styles.statLabel}>MATCHED (50 pertama)</Text>
                <Text style={[styles.statValue, { color: "#15803D" }]}>{matched}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: "#FEF2F2" }]}>
                <Text style={styles.statLabel}>NO MATCH</Text>
                <Text style={[styles.statValue, { color: "#B91C1C" }]}>{unmatched}</Text>
              </View>
            </View>

            {preview.failed > 0 && (
              <Text style={styles.skippedNote}>{preview.failed} baris dilewati saat parsing (header/kosong).</Text>
            )}

            <Text style={[styles.label, { marginTop: 12, marginBottom: 6 }]}>
              Pratinjau {preview.preview.length} baris pertama
            </Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.cellNrp, styles.cellHead]}>NRP</Text>
                <Text style={[styles.cellNama, styles.cellHead]}>Nama</Text>
                <Text style={[styles.cellRight, styles.cellHead]}>Sisa Gaji</Text>
                <Text style={[styles.cellStatus, styles.cellHead]}>Status</Text>
              </View>
              {preview.preview.map((p) => (
                <View key={p.row} style={styles.tableRow}>
                  <Text style={styles.cellNrp}>{p.nrp || "-"}</Text>
                  <Text style={styles.cellNama} numberOfLines={1}>{p.nama || "-"}</Text>
                  <Text style={styles.cellRight}>{rupiah(p.sisaGaji)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: p.status === "valid" ? "#DCFCE7" : "#FEE2E2" }]}>
                    <Text style={[styles.statusPillText, { color: p.status === "valid" ? "#15803D" : "#B91C1C" }]}>
                      {p.status === "valid" ? "Match" : "No"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Step 5: commit / cancel */}
            <View style={{ flexDirection: "row", marginTop: 20, gap: 10 }}>
              <TouchableOpacity onPress={reset} style={[styles.primaryBtn, { flex: 1, backgroundColor: "#F1F5F9" }]}>
                <Text style={[styles.primaryBtnText, { color: C.foreground }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doCommit}
                disabled={loading}
                style={[styles.primaryBtn, { flex: 2, backgroundColor: C.primary }]}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={styles.primaryBtnText}>Import ({preview.totalRows} data)</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Loading overlay for commit (preview loads inline) */}
        {loading && preview && (
          <View style={styles.committingNote}>
            <ActivityIndicator color={C.primary} />
            <Text style={{ marginLeft: 8, color: C.mutedForeground, fontSize: 13 }}>
              Memproses import... (mungkin butuh beberapa menit)
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center",
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  headerSub: { color: "#FFF", fontSize: 12, opacity: 0.8, marginTop: 2 },
  label: { fontSize: 13, fontWeight: "bold", color: C.primary, marginBottom: 8, marginLeft: 2 },
  sourceBtn: {
    flex: 1, padding: 12, borderRadius: 10, marginRight: 8, borderWidth: 1,
    borderColor: "#CBD5E1", backgroundColor: "#FFF", alignItems: "center",
  },
  sourceBtnActive: { borderColor: C.accent, backgroundColor: C.accent },
  sourceBtnText: { fontSize: 13, fontWeight: "bold", color: C.mutedForeground },
  sourceBtnTextActive: { color: "#FFF" },
  filePicker: {
    backgroundColor: "#FFF", padding: 32, borderRadius: 14, borderWidth: 2, borderStyle: "dashed",
    alignItems: "center", marginBottom: 16,
  },
  filePickerTitle: { marginTop: 12, fontSize: 15, fontWeight: "bold", color: C.foreground },
  fileName: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
  primaryBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    padding: 14, borderRadius: 12, marginTop: 4,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  previewBox: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0",
  },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  previewPeriod: { fontSize: 16, fontWeight: "bold", color: C.foreground },
  previewSheet: { fontSize: 11, color: C.mutedForeground },
  statRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" },
  statLabel: { fontSize: 9, fontWeight: "bold", color: C.mutedForeground },
  statValue: { fontSize: 20, fontWeight: "bold", marginTop: 4 },
  skippedNote: { fontSize: 11, color: "#D97706", marginTop: 8 },
  table: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, overflow: "hidden" },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  tableHead: { backgroundColor: "#F8FAFC" },
  cellHead: { fontSize: 10, fontWeight: "bold", color: C.mutedForeground },
  cellNrp: { flex: 1.1, fontSize: 11, color: C.foreground },
  cellNama: { flex: 2, fontSize: 11, color: C.foreground },
  cellRight: { flex: 1.4, fontSize: 11, color: C.foreground, textAlign: "right", marginRight: 6 },
  cellStatus: { fontSize: 10, color: C.mutedForeground },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: "bold" },
  committingNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, padding: 12 },
});
