import React, { useCallback, useEffect, useMemo, useState } from "react";
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

// ── Categories (mirror Asset schema comment — server-side, not importable into RN) ─
const CATEGORIES: { key: string; label: string }[] = [
  { key: "building", label: "Gedung / Bangunan" },
  { key: "vehicle", label: "Kendaraan" },
  { key: "equipment", label: "Peralatan" },
  { key: "furniture", label: "Mebel / Furniture" },
  { key: "computer", label: "Komputer / Elektronik" },
  { key: "other", label: "Lainnya" },
];

const formatRp = (n: number) =>
  "Rp " + (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const toIsoDate = (d: Date) => {
  // YYYY-MM-DD — matches the server's `new Date(acquisitionDate)` parsing.
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().split("T")[0];
};

type Mode = "create" | "edit";

export default function AsetFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { mode, assetId } = (route.params || {}) as { mode: Mode; assetId?: number };
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // Shared fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [acquisitionDate, setAcquisitionDate] = useState<Date>(new Date());
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // Edit-only fields
  const [residualValue, setResidualValue] = useState("");
  const [accumulatedDepreciation, setAccumulatedDepreciation] = useState("");

  // Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // ── Pre-fill (edit mode) ──────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    if (!isEdit || !assetId) return;
    try {
      const res = await api.get(`/api/mobile/assets/${assetId}`);
      const a = res.data?.data;
      if (a) {
        setCode(a.code || "");
        setName(a.name || "");
        setCategory(a.category || "");
        setAcquisitionDate(a.acquisitionDate ? new Date(a.acquisitionDate) : new Date());
        setAcquisitionCost(a.acquisitionCost != null ? String(a.acquisitionCost) : "");
        setUsefulLifeYears(
          a.usefulLifeYears != null ? String(a.usefulLifeYears) : ""
        );
        setLocation(a.location || "");
        setDescription(a.description || "");
        setResidualValue(a.residualValue != null ? String(a.residualValue) : "");
        setAccumulatedDepreciation(
          a.accumulatedDepreciation != null ? String(a.accumulatedDepreciation) : ""
        );
      }
    } catch (err) {
      log.warn("AsetForm: failed to load asset detail", err);
      Toast.show({
        type: "error",
        text1: "Gagal Memuat",
        text2: "Tidak dapat memuat data aset.",
      });
    } finally {
      setLoading(false);
    }
  }, [isEdit, assetId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // ── Live bookValue preview ────────────────────────────────────────────────
  const costNum = Number(acquisitionCost) || 0;
  const accDepNum = Number(accumulatedDepreciation) || 0;
  const bookValuePreview = useMemo(() => costNum - accDepNum, [costNum, accDepNum]);

  const categoryLabel = (key: string) =>
    CATEGORIES.find((c) => c.key === key)?.label || (key ? key : "Pilih kategori...");

  // ── Validation ────────────────────────────────────────────────────────────
  const costValid = acquisitionCost !== "" && !isNaN(Number(acquisitionCost)) && Number(acquisitionCost) > 0;
  const lifeValid =
    usefulLifeYears !== "" && !isNaN(Number(usefulLifeYears)) && Number(usefulLifeYears) > 0;
  const canSubmit =
    !submitting &&
    code.trim() !== "" &&
    name.trim() !== "" &&
    category !== "" &&
    costValid &&
    lifeValid;

  const submit = async () => {
    if (!code.trim() || !name.trim()) {
      Toast.show({ type: "error", text1: "Lengkapi Data", text2: "Kode dan nama wajib diisi." });
      return;
    }
    if (!category) {
      Toast.show({ type: "error", text1: "Pilih Kategori", text2: "Kategori aset wajib dipilih." });
      return;
    }
    if (!costValid) {
      Toast.show({ type: "error", text1: "Harga Tidak Valid", text2: "Harga perolehan harus > 0." });
      return;
    }
    if (!lifeValid) {
      Toast.show({ type: "error", text1: "Umur Tidak Valid", text2: "Umur manfaat (tahun) harus > 0." });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          code: code.trim(),
          name: name.trim(),
          category,
          acquisitionDate: toIsoDate(acquisitionDate),
          acquisitionCost: costNum,
          usefulLifeYears: Number(usefulLifeYears),
          residualValue: Number(residualValue) || 0,
          accumulatedDepreciation: accDepNum,
          location: location.trim() || null,
          description: description.trim() || null,
        };
        const res = await api.put(`/api/mobile/assets/${assetId}`, body);
        if (res.status >= 200 && res.status < 300) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Toast.show({
            type: "success",
            text1: "Tersimpan",
            text2: "Perubahan aset berhasil disimpan.",
          });
          navigation.goBack();
        }
      } else {
        const body: Record<string, unknown> = {
          code: code.trim(),
          name: name.trim(),
          category,
          acquisitionDate: toIsoDate(acquisitionDate),
          acquisitionCost: costNum,
          usefulLifeYears: Number(usefulLifeYears),
          location: location.trim() || null,
          description: description.trim() || null,
        };
        const res = await api.post("/api/mobile/assets", body);
        if (res.status === 201) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Toast.show({
            type: "success",
            text1: "Tercatat",
            text2: "Aset baru berhasil ditambahkan.",
          });
          navigation.goBack();
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg =
        data?.message ||
        err?.message ||
        (isEdit ? "Gagal mengupdate aset." : "Gagal menyimpan aset.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: "error", text1: "Gagal", text2: msg });
      log.warn("AsetForm: submit failed", { status, msg });
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.headerTitle}>
          {isEdit ? "Edit Aset" : "Tambah Aset"}
        </Text>
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
          ) : (
            <>
              {/* Code */}
              <Text style={styles.label}>Kode Aset *</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Contoh: AST-001"
                autoCapitalize="characters"
              />

              {/* Name */}
              <Text style={styles.label}>Nama Aset *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Laptop Asus ROG"
              />

              {/* Category Picker */}
              <Text style={styles.label}>Kategori *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowCategoryPicker((v) => !v)}
              >
                <Text
                  style={{
                    flex: 1,
                    color: category ? C.foreground : C.mutedForeground,
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
                  {CATEGORIES.map((c) => (
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

              {/* Acquisition Date */}
              <Text style={styles.label}>Tanggal Perolehan *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: C.foreground, flex: 1 }}>
                  {acquisitionDate.toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={C.mutedForeground} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={acquisitionDate}
                  mode="date"
                  display="default"
                  onChange={(_e, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) setAcquisitionDate(date);
                  }}
                />
              )}

              {/* Acquisition Cost */}
              <Text style={styles.label}>Harga Perolehan (Rp) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={acquisitionCost}
                onChangeText={setAcquisitionCost}
                placeholder="Contoh: 10000000"
              />
              {acquisitionCost !== "" && !isNaN(Number(acquisitionCost)) && (
                <Text style={styles.hint}>{formatRp(Number(acquisitionCost))}</Text>
              )}

              {/* Useful Life */}
              <Text style={styles.label}>Umur Manfaat (Tahun) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={usefulLifeYears}
                onChangeText={setUsefulLifeYears}
                placeholder="Contoh: 5"
              />

              {/* Edit-only: residual + accumulated depreciation + bookValue preview */}
              {isEdit && (
                <View style={styles.editGroup}>
                  <Text style={styles.sectionTitle}>Nilai Penyusutan</Text>

                  <Text style={styles.label}>Nilai Residu (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={residualValue}
                    onChangeText={setResidualValue}
                    placeholder="0"
                  />

                  <Text style={styles.label}>Akum. Penyusutan (Rp)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={accumulatedDepreciation}
                    onChangeText={setAccumulatedDepreciation}
                    placeholder="0"
                  />

                  <View style={styles.bookValuePreview}>
                    <Text style={styles.bookValueLabel}>Nilai Buku (Preview)</Text>
                    <Text
                      style={[
                        styles.bookValueAmount,
                        { color: bookValuePreview >= 0 ? C.success : C.warning },
                      ]}
                    >
                      {formatRp(bookValuePreview)}
                    </Text>
                    <Text style={styles.bookValueHint}>
                      Harga Perolehan − Akum. Penyusutan
                    </Text>
                  </View>
                </View>
              )}

              {/* Location */}
              <Text style={styles.label}>Lokasi</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Opsional — contoh: Kantor Pusat"
              />

              {/* Description */}
              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Catatan singkat (opsional)"
                multiline
              />

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
                  {submitting ? "Memproses..." : isEdit ? "Simpan Perubahan" : "Tambah Aset"}
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
  hint: {
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
  editGroup: {
    marginTop: 12,
    padding: 16,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  bookValuePreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: C.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  bookValueLabel: {
    fontSize: 12,
    color: C.mutedForeground,
    marginBottom: 4,
  },
  bookValueAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  bookValueHint: {
    fontSize: 11,
    color: C.mutedForeground,
    marginTop: 4,
  },
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
