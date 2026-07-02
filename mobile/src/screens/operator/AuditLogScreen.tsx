import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "../../lib/api";
import C from "../../lib/colors";
import { log } from "../../utils/log";

export default function AuditLogScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/audit-logs?search=${query ?? search}`);
      setLogs(res.data.data || []);
    } catch (err) {
      log.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData("");
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = () => {
    loadData(search);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE": return "add-circle";
      case "UPDATE": return "pencil";
      case "DELETE": return "trash";
      case "LOGIN": return "log-in";
      case "LOGOUT": return "log-out";
      default: return "flash";
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return C.success;
      case "UPDATE": return C.info;
      case "DELETE": return C.destructive;
      case "LOGIN": return C.success;
      case "LOGOUT": return C.warning;
      case "LOGIN_FAILED": return C.destructive;
      default: return C.accent;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const iconName = getActionIcon(item.action);
    const iconColor = getActionColor(item.action);

    return (
      <View style={styles.logCard}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + "20" }]}>
          <Ionicons name={iconName as any} size={20} color={iconColor} />
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logDesc}>{item.description}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              <Ionicons name="person-outline" size={12} /> {item.userName} ({item.userRole})
            </Text>
            <Text style={styles.metaText}>
              <Ionicons name="time-outline" size={12} />{" "}
              {new Date(item.timestamp).toLocaleString("id-ID", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: C.primaryLight }]}>
              <Text style={styles.badgeText}>{item.module}</Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.status === "success" ? C.successBg : C.destructiveBg },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: item.status === "success" ? C.success : C.destructive },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Audit Log</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari user, deskripsi, atau modul..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat audit log...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Tidak ada history operasional</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.accent]}
            />
          }
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  searchRow: { flexDirection: "row", gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFF",
  },
  searchBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
  logCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  logInfo: { flex: 1 },
  logDesc: { fontSize: 14, fontWeight: "600", color: C.foreground, lineHeight: 20, marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  metaText: { fontSize: 11, color: C.mutedForeground },
  badgeRow: { flexDirection: "row", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "bold", color: "#FFF", letterSpacing: 0.5 },
});
