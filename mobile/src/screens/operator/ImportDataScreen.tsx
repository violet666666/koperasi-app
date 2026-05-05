import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import C from "../../lib/colors";
import api from "../../lib/api";

type ImportRecordStatus = {
  success: number;
  skip: number;
  errors: string[];
};

export default function ImportDataScreen({ navigation }: any) {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [type, setType] = useState<"tunkin_only" | "member_full" | "pinjaman_update">("member_full");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportRecordStatus | null>(null);

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
      setResult(null);

      if (type === "pinjaman_update") {
        // XLSX handled server-side, no local parsing
        setRecords([{ _file: file.name, _note: "File akan diproses oleh server" }]);
      } else {
        // CSV parse locally
        setLoading(true);
        const csvString = await FileSystem.readAsStringAsync(file.uri, { encoding: "utf8" });
        const parsed = parseCSV(csvString);
        setRecords(parsed);
        setLoading(false);
      }
    } catch (error) {
       Alert.alert("Gagal", "Aplikasi kesulitan memproses file tersebut.");
       setLoading(false);
    }
  };

  const parseCSV = (csvStr: string) => {
     // A simple CSV Parser considering carriage returns
     const rows = csvStr.split(/\r?\n/).filter(r => r.trim() !== "");
     if (rows.length < 2) return [];

     const headers = rows[0].split(",").map(h => h.trim());
     const result = [];

     for (let i = 1; i < rows.length; i++) {
         const cols = rows[i].split(",");
         if (cols.length < headers.length) continue; 
         let obj: any = {};
         for (let j = 0; j < headers.length; j++) {
             obj[headers[j]] = cols[j]?.trim() || "";
         }
         result.push(obj);
     }
     return result;
  };

  const submitImport = async () => {
     if (records.length === 0) {
        return Alert.alert("Kosong", "Tidak ada baris data terdeteksi.");
     }
     if (!fileUri) {
        return Alert.alert("Kosong", "Pilih file terlebih dahulu.");
     }

     setLoading(true);
     try {
       if (type === "pinjaman_update") {
         const formData = new FormData();
         const ext = fileName?.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls';
         const mimeType = ext === 'xlsx'
           ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
           : 'application/vnd.ms-excel';
         formData.append('file', {
           uri: fileUri,
           type: mimeType,
           name: fileName || 'import.xlsx',
         } as any);
         formData.append('mode', 'commit');

         const res = await api.post("/api/loans/import-update", formData, {
           headers: { 'Content-Type': 'multipart/form-data' },
         });
         setResult(res.data.data || { success: res.data.created || 0, skip: res.data.skipped || 0, errors: res.data.errors || [] });
         Alert.alert("Import Pinjaman Selesai", res.data.message || "Data pinjaman diperbarui");
       } else {
         const res = await api.post("/api/mobile/members/import", {
             type,
             records
         });
         setResult(res.data.data);
         Alert.alert("Import Selesai", res.data.message);
       }
     } catch (error: any) {
       const msg = error.response?.data?.message || "Gagal menghubungi server.";
       Alert.alert("Kesalahan Jaringan", msg);
     } finally {
       setLoading(false);
     }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Import Format CSV</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* Type Selection */}
        <Text style={{ fontSize: 14, fontWeight: "bold", color: C.primary, marginBottom: 8, marginLeft: 4 }}>
           Jenis Pembaruan Data
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
           <TouchableOpacity
              onPress={() => { setType("member_full"); setRecords([]); setResult(null); }}
              style={{ flex: 1, backgroundColor: type === "member_full" ? C.accent : "white", padding: 12, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: type === "member_full" ? C.accent : "#cbd5e1", alignItems: "center" }}
           >
              <Text style={{ fontSize: 13, fontWeight: "bold", color: type === "member_full" ? "white" : C.mutedForeground }}>Anggota Baru</Text>
           </TouchableOpacity>
           <TouchableOpacity
              onPress={() => { setType("tunkin_only"); setRecords([]); setResult(null); }}
              style={{ flex: 1, backgroundColor: type === "tunkin_only" ? C.accent : "white", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: type === "tunkin_only" ? C.accent : "#cbd5e1", alignItems: "center" }}
           >
              <Text style={{ fontSize: 13, fontWeight: "bold", color: type === "tunkin_only" ? "white" : C.mutedForeground }}>Tunkin & Gaji</Text>
           </TouchableOpacity>
        </View>
        <TouchableOpacity
           onPress={() => { setType("pinjaman_update"); setRecords([]); setResult(null); }}
           style={{ backgroundColor: type === "pinjaman_update" ? C.accent : "white", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: type === "pinjaman_update" ? C.accent : "#cbd5e1", alignItems: "center", marginBottom: 20 }}
        >
           <Text style={{ fontSize: 13, fontWeight: "bold", color: type === "pinjaman_update" ? "white" : C.mutedForeground }}>Update Pinjaman SP (XLSX)</Text>
        </TouchableOpacity>

        {type === "pinjaman_update" && (
          <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE" }}>
            <Text style={{ fontSize: 12, color: "#1E40AF" }}>Upload file Rincian Piutang SP (.xlsx). Sheet2 akan diproses untuk update saldo pinjaman dan pembayaran bulanan 2026.</Text>
          </View>
        )}

        {/* File Picker */}
        <TouchableOpacity 
           onPress={pickFile}
           style={{ backgroundColor: "white", padding: 40, borderRadius: 16, borderStyle: "dashed", borderWidth: 2, borderColor: fileUri ? "#10B981" : C.primary, alignItems: "center", marginBottom: 20 }}
        >
           <Ionicons name={fileUri ? "document-text" : "cloud-upload"} size={48} color={fileUri ? "#10B981" : C.primary} />
           <Text style={{ marginTop: 16, fontSize: 16, fontWeight: "bold", color: C.foreground }}>
               {fileUri ? "Ganti File Terpilih" : "Pilih File Excel CSV Spreadsheet"}
           </Text>
           {fileName && <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>{fileName}</Text>}
        </TouchableOpacity>

        {loading ? (
           <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 20 }} />
        ) : (
           records.length > 0 && !result && (
              <View style={{ backgroundColor: "#f1f5f9", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" }}>
                 <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                     <Text style={{ fontSize: 14, fontWeight: "bold", color: C.foreground }}>
                       {type === "pinjaman_update" ? "File Siap Upload" : `Pratinjau ${Math.min(records.length, 50)} dari ${records.length} Baris`}
                     </Text>
                 </View>

                 {type === "pinjaman_update" ? (
                   <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
                     <Ionicons name="document-text" size={20} color={C.primary} />
                     <Text style={{ fontSize: 13, color: C.foreground, fontWeight: "500" }}>{fileName}</Text>
                   </View>
                 ) : (
                 records.slice(0, 50).map((row, idx) => (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 8 }}>
                        <Text style={{ fontSize: 12, color: C.foreground, fontWeight: "500", flex: 1 }}>{row["nrp"] || row["NRP"] || "TANPA NRP"}</Text>
                        <Text style={{ fontSize: 12, color: C.mutedForeground, flex: 2, textAlign: "right" }}>{row["nama"] || row["NAMA"] || row["tunkin"] || row["TUNKIN"] || "..."}</Text>
                    </View>
                 ))
                 )}

                 <TouchableOpacity onPress={submitImport} style={{ backgroundColor: C.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 24, elevation: 2 }}>
                     <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                       {type === "pinjaman_update" ? "Upload & Update Pinjaman" : `Mulai Upload Data (${records.length} Baris)`}
                     </Text>
                 </TouchableOpacity>
              </View>
           )
        )}

        {/* Result Block */}
        {result && (
            <View style={{ backgroundColor: "white", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={{ fontSize: 18, fontWeight: "bold", color: C.foreground, marginVertical: 8 }}>Import Selesai</Text>
                
                <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                   <View style={{ backgroundColor: "#dcfce7", padding: 12, borderRadius: 8, alignItems: "center", flex: 1 }}>
                       <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "bold" }}>BERHASIL MASUK</Text>
                       <Text style={{ fontSize: 24, color: "#15803d", fontWeight: "bold" }}>{result.success}</Text>
                   </View>
                   <View style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 8, alignItems: "center", flex: 1 }}>
                       <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "bold" }}>GAGAL / SKIP</Text>
                       <Text style={{ fontSize: 24, color: "#b91c1c", fontWeight: "bold" }}>{result.skip}</Text>
                   </View>
                </View>

                {result.errors.length > 0 && (
                   <View style={{ width: "100%", marginTop: 20, backgroundColor: "#fff1f2", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#fecdd3" }}>
                       <Text style={{ fontSize: 12, fontWeight: "bold", color: "#be123c", marginBottom: 8 }}>Log Kesalahan (10 baris pertama)</Text>
                       {result.errors.map((e, i) => <Text key={i} style={{ fontSize: 10, color: "#e11d48", marginBottom: 4 }}>• {e}</Text>)}
                   </View>
                )}

                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, padding: 12, backgroundColor: "#f1f5f9", borderRadius: 8, width: "100%", alignItems: "center" }}>
                    <Text style={{ color: C.primary, fontWeight: "600" }}>Tutup Layar Ini</Text>
                </TouchableOpacity>
            </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
