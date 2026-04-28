import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "../../lib/api";
import C from "../../lib/colors";

const formatRp = (n: number) =>
  "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

interface KoperasiProfile {
  name: string;
  legalName: string;
  registrationNumber: string;
  taxId: string;
  establishedDate: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  totalMembers: number;
  totalSavings: number;
  totalLoans: number;
}

const DEFAULT_PROFILE: KoperasiProfile = {
  name: "PRIMKOPPOL Resor Lumajang",
  legalName: "Primer Koperasi Kepolisian Resor Lumajang",
  registrationNumber: "518/BH/KDK.9/III/2005",
  taxId: "01.234.567.8-012.345",
  establishedDate: "2005-03-15",
  address: "Jl. Alun-Alun Utara No. 1",
  city: "Kabupaten Lumajang",
  province: "Jawa Timur",
  postalCode: "67316",
  phone: "(0334) 881110",
  email: "primkoppol@polreslumajang.go.id",
  website: "https://primkoppol-polreslumajang.go.id",
  description:
    "Primer Koperasi Kepolisian yang melayani anggota Polres Lumajang dan jajarannya untuk meningkatkan kesejahteraan anggota melalui layanan simpanan dan pinjaman.",
  totalMembers: 0,
  totalSavings: 0,
  totalLoans: 0,
};

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color={C.accent} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, onPress && { color: C.info }]}>
          {value}
        </Text>
      </View>
      {onPress && (
        <Ionicons
          name="open-outline"
          size={16}
          color={C.info}
          style={{ marginLeft: 4 }}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={C.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function ProfilKoperasiScreen() {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<KoperasiProfile>(DEFAULT_PROFILE);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/api/mobile/summary");
      const d = res.data;
      setProfile((prev) => ({
        ...prev,
        totalMembers: d.activeMembers ?? prev.totalMembers,
        totalSavings: d.totalSavings ?? prev.totalSavings,
        totalLoans: d.totalLoansOutstanding ?? prev.totalLoans,
      }));
    } catch {
      // keep defaults if API fails
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const ageYears =
    new Date().getFullYear() - new Date(profile.establishedDate).getFullYear();

  const formattedDate = new Date(profile.establishedDate).toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

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
        <Text style={styles.headerTitle}>Profil PRIMKOPPOL</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Image
            source={require("../../../assets/LogoPrimkoppol.png")}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.heroName}>{profile.name}</Text>
          <Text style={styles.heroLegal}>{profile.legalName}</Text>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={14} color={C.accent} />
            <Text style={styles.heroBadgeText}>
              PRIMKOPPOL Polres Lumajang Berdiri {ageYears} Tahun
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.totalMembers > 0
                ? profile.totalMembers.toLocaleString("id-ID")
                : "—"}
            </Text>
            <Text style={styles.statLabel}>Anggota</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { fontSize: 13 }]}>
              {profile.totalSavings > 0
                ? `Rp ${(profile.totalSavings / 1_000_000).toFixed(1)}jt`
                : "—"}
            </Text>
            <Text style={styles.statLabel}>Total Simpanan</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{ageYears}</Text>
            <Text style={styles.statLabel}>Tahun Berdiri</Text>
          </View>
        </View>

        {/* Identitas */}
        <SectionCard title="Identitas PRIMKOPPOL" icon="business-outline">
          <InfoRow
            icon="document-text-outline"
            label="No. Badan Hukum"
            value={profile.registrationNumber}
          />
          <InfoRow icon="card-outline" label="NPWP" value={profile.taxId} />
          <InfoRow
            icon="calendar-outline"
            label="Tanggal Berdiri"
            value={formattedDate}
          />
        </SectionCard>

        {/* Alamat */}
        <SectionCard title="Alamat" icon="location-outline">
          <InfoRow icon="home-outline" label="Alamat" value={profile.address} />
          <InfoRow
            icon="map-outline"
            label="Kota/Kabupaten"
            value={profile.city}
          />
          <InfoRow
            icon="flag-outline"
            label="Provinsi"
            value={profile.province}
          />
          <InfoRow
            icon="mail-outline"
            label="Kode Pos"
            value={profile.postalCode}
          />
        </SectionCard>

        {/* Kontak */}
        <SectionCard title="Kontak" icon="call-outline">
          <InfoRow
            icon="call-outline"
            label="Telepon"
            value={profile.phone}
            onPress={() =>
              Linking.openURL(`tel:${profile.phone.replace(/\s/g, "")}`)
            }
          />
          <InfoRow
            icon="at-outline"
            label="Email"
            value={profile.email}
            onPress={() => Linking.openURL(`mailto:${profile.email}`)}
          />
          <InfoRow
            icon="globe-outline"
            label="Website"
            value={profile.website}
            onPress={() => Linking.openURL(profile.website)}
          />
        </SectionCard>

        {/* Tentang */}
        <SectionCard title="Tentang PRIMKOPPOL" icon="information-circle-outline">
          <Text style={styles.descText}>{profile.description}</Text>
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    backgroundColor: C.primary,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: C.primary,
    borderRadius: 20,
    alignItems: "center",
    padding: 28,
    marginBottom: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heroLogo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  heroName: {
    fontSize: 18,
    fontWeight: "800",
    color: C.accent,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  heroLegal: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212,175,55,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
  },
  heroBadgeText: {
    color: C.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: C.primary,
  },
  statLabel: {
    fontSize: 11,
    color: C.mutedForeground,
    marginTop: 4,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  sectionCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.accentBg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.primary,
  },
  sectionBody: {
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.muted,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.accentBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: C.mutedForeground,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: C.foreground,
    fontWeight: "500",
  },
  descText: {
    fontSize: 14,
    color: C.foreground,
    lineHeight: 22,
    padding: 16,
  },
});
