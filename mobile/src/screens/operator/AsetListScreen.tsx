import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import C from "../../lib/colors";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../lib/api";

type Asset = {
  id: number;
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  status: string;
};

export default function AsetListScreen({ navigation }: any) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchAssets = async () => {
    try {
      const res = await api.get(`/api/mobile/assets?search=${search}`);
      setAssets(res.data.data || []);
    } catch (error) {
      console.warn("Error fetching assets:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAssets();
    }, [search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <View style={{ backgroundColor: "#10B981", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>AKTIF</Text></View>;
      case "disposed":
        return <View style={{ backgroundColor: "#F43F5E", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>DIJUAL</Text></View>;
      case "under_maintenance":
        return <View style={{ backgroundColor: "#F59E0B", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>MAINTENANCE</Text></View>;
      default:
        return <View style={{ backgroundColor: "#94A3B8", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>{status.toUpperCase()}</Text></View>;
    }
  };

  const renderAssetCard = ({ item }: { item: Asset }) => {
     const percentage = item.acquisitionCost > 0 
        ? (item.accumulatedDepreciation / item.acquisitionCost) * 100 
        : 0;

     return (
        <TouchableOpacity
            style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
                borderWidth: 1,
                borderColor: "#f1f5f9"
            }}
            onPress={() => navigation.navigate("AsetDetail", { assetId: item.id })}
        >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: "bold", color: C.foreground, marginBottom: 4 }}>
                        {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.mutedForeground }}>
                        {item.code} • {item.category.toUpperCase()}
                    </Text>
                </View>
                {getStatusBadge(item.status)}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <View>
                    <Text style={{ fontSize: 12, color: C.mutedForeground }}>Harga Perolehan</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.foreground }}>
                        {formatRupiah(item.acquisitionCost)}
                    </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 12, color: C.mutedForeground }}>Nilai Buku Aktif</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#10B981" }}>
                        {formatRupiah(item.bookValue)}
                    </Text>
                </View>
            </View>

            {/* Depreciation Progress Bar */}
            <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                   <Text style={{ fontSize: 10, color: C.mutedForeground }}>Akum. Penyusutan: {formatRupiah(item.accumulatedDepreciation)}</Text>
                   <Text style={{ fontSize: 10, color: C.mutedForeground, fontWeight: "bold" }}>{percentage.toFixed(0)}% Disusutkan</Text>
                </View>
                <View style={{ height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                   <View style={{ height: "100%", width: `${Math.min(100, percentage)}%`, backgroundColor: "#F43F5E", borderRadius: 3 }} />
                </View>
            </View>
        </TouchableOpacity>
     );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>Inventaris Aset</Text>
        </View>
        <View style={{ marginTop: 16, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
          <Ionicons name="search" size={20} color="white" />
          <TextInput
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: "white", fontSize: 14 }}
            placeholder="Cari nama atau kode aset..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="white" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAssetCard}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
              <Text style={{ color: C.mutedForeground, marginTop: 12 }}>Tidak ada aset ditemukan.</Text>
            </View>
          }
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}

      {/* FAB Floating Action Button */}
      {/* <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 30,
          right: 20,
          backgroundColor: C.accent,
          width: 60,
          height: 60,
          borderRadius: 30,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#0EA5E9",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }}
        onPress={() => navigation.navigate("AsetTambah")}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity> */}
    </View>
  );
}
