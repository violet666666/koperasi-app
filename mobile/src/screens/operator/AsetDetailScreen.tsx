import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import C from "../../lib/colors";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import api from "../../lib/api";

export default function AsetDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const { assetId } = route.params || {};

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAssetDetail = async () => {
    try {
      const res = await api.get(`/api/mobile/assets/${assetId}`);
      setAsset(res.data.data);
    } catch (error) {
      console.warn("Error fetching asset details:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAssetDetail();
    }, [assetId])
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
                 <View style={{ backgroundColor: "#e2e8f0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={{ fontSize: 10, fontWeight: "bold", color: "#475569" }}>{asset.category.toUpperCase()}</Text>
                 </View>
             </View>

             <View style={{ height: 1, backgroundColor: "#f1f5f9", marginVertical: 12 }} />

             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Tanggal Beli</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: C.foreground }}>{formatDate(asset.acquisitionDate)}</Text>
             </View>
             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                 <Text style={{ fontSize: 12, color: C.mutedForeground }}>Status</Text>
                 <Text style={{ fontSize: 13, fontWeight: "600", color: asset.status === "active" ? "#10B981" : "#F43F5E" }}>
                     {asset.status === "active" ? "Aktif Beroperasi" : asset.status.toUpperCase()}
                 </Text>
             </View>
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

         <View style={{ height: 20 }}/>
      </ScrollView>
    </View>
  );
}
