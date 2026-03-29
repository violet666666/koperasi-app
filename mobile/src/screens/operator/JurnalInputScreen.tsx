import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C } from "../common/colors";
import api from "../../lib/api";

type Account = {
  id: number;
  code: string;
  name: string;
};

type JournalLineData = {
  id: string; // temp id
  accountId: number | null;
  debit: string;
  credit: string;
  description: string;
};

export default function JurnalInputScreen({ navigation }: any) {
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [lines, setLines] = useState<JournalLineData[]>([
    { id: "1", accountId: null, debit: "", credit: "", description: "" },
    { id: "2", accountId: null, debit: "", credit: "", description: "" },
  ]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/api/mobile/accounts?isDetail=true");
      setAccounts(res.data.data);
    } catch (error) {
      Alert.alert("Error", "Gagal memuat Chart of Accounts");
    } finally {
      setLoadingAcc(false);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      { id: Date.now().toString(), accountId: null, debit: "", credit: "", description: "" },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      Alert.alert("Minimal 2 Baris", "Jurnal Akuntansi membutuhkan setidaknya 2 baris (Debit & Kredit)");
      return;
    }
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof JournalLineData, value: any) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  // Logic Calculations
  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const submitJournal = async () => {
    if (!description || !date) return Alert.alert("Validasi", "Deskripsi dan Tanggal wajib diisi.");
    if (!isBalanced) return Alert.alert("Tidak Seimbang", "Total Debit harus sama persis dengan Total Kredit.");
    
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].accountId) {
            return Alert.alert("Validasi", `Pilih Akun pada baris ke-${i + 1}`);
        }
        if (!lines[i].debit && !lines[i].credit) {
            return Alert.alert("Validasi", `Isi Debit atau Kredit pada baris ke-${i + 1}`);
        }
    }

    setSubmitting(true);
    try {
      const payload = {
        date: date.toISOString(),
        description,
        lines: lines.map(l => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description,
        })),
      };

      const res = await api.post("/api/mobile/journals", payload);
      Alert.alert("Sukses", `Jurnal tersimpan: ${res.data.data?.journalNo}`, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Gagal menyimpan jurnal.";
      Alert.alert("Gagal", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Input Jurnal Manual</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        <View style={{ backgroundColor: "white", padding: 16, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: C.foreground, marginBottom: 8 }}>
            Tanggal Transaksi
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="calendar-outline" size={20} color={C.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 14, color: C.foreground }}>
              {date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          <Text style={{ fontSize: 14, fontWeight: "600", color: C.foreground, marginBottom: 8 }}>
            Keterangan / Deskripsi Global
          </Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, fontSize: 14, color: C.foreground }}
            placeholder="Contoh: Pembelian Inventaris Tunai"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {loadingAcc ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 20 }} />
        ) : (
            lines.map((line, index) => (
            <View key={line.id} style={{ backgroundColor: "white", padding: 16, borderRadius: 12, marginBottom: 16, position: "relative" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: C.primary }}>Baris {index + 1}</Text>
                {lines.length > 2 && (
                    <TouchableOpacity onPress={() => removeLine(line.id)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={24} color="#F43F5E" />
                    </TouchableOpacity>
                )}
                </View>

                {/* Account Picker */}
                <View style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, marginBottom: 12, backgroundColor: "#f8fafc" }}>
                <Picker
                    selectedValue={line.accountId}
                    onValueChange={(val) => updateLine(line.id, "accountId", val)}
                    style={{ height: 50 }}
                >
                    <Picker.Item label="-- Pilih Akun --" value={null} color={C.mutedForeground} />
                    {accounts.map(acc => (
                    <Picker.Item key={acc.id} label={`${acc.code} - ${acc.name}`} value={acc.id} />
                    ))}
                </Picker>
                </View>

                {/* Debit & Credit Row */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 4 }}>Debit (Rp)</Text>
                    <TextInput
                    style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: line.credit ? "#f1f5f9" : "white" }}
                    placeholder="0"
                    keyboardType="numeric"
                    value={line.debit}
                    onChangeText={(val) => {
                        updateLine(line.id, "debit", val);
                        if (val) updateLine(line.id, "credit", ""); // Jika diisi, kosongkan kredit
                    }}
                    editable={!line.credit}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: C.mutedForeground, marginBottom: 4 }}>Kredit (Rp)</Text>
                    <TextInput
                    style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: line.debit ? "#f1f5f9" : "white" }}
                    placeholder="0"
                    keyboardType="numeric"
                    value={line.credit}
                    onChangeText={(val) => {
                        updateLine(line.id, "credit", val);
                        if (val) updateLine(line.id, "debit", ""); // Jika diisi, kosongkan debit
                    }}
                    editable={!line.debit}
                    />
                </View>
                </View>

                <TextInput
                style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, fontSize: 12 }}
                placeholder="Catatan baris (opsional)"
                value={line.description}
                onChangeText={(val) => updateLine(line.id, "description", val)}
                />
            </View>
            ))
        )}

        {/* Add Row Button */}
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderStyle: "dashed", borderWidth: 2, borderColor: C.mutedForeground, borderRadius: 12 }}
          onPress={addLine}
        >
          <Ionicons name="add" size={20} color={C.mutedForeground} style={{ marginRight: 8 }} />
          <Text style={{ color: C.mutedForeground, fontWeight: "bold" }}>Tambah Baris Jurnal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky Footer Tracker */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 12, color: C.mutedForeground }}>Total Debit</Text>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#10B981" }}>{formatRupiah(totalDebit)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 12, color: C.mutedForeground }}>Total Kredit</Text>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#F43F5E" }}>{formatRupiah(totalCredit)}</Text>
          </View>
        </View>

        <TouchableOpacity
          disabled={submitting || !isBalanced}
          style={{
            backgroundColor: isBalanced ? C.primary : "#94a3b8",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}
          onPress={submitJournal}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              {isBalanced ? "Simpan Jurnal" : "Jurnal Belum Seimbang (Balance)"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
