import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const LATAR_PREFIX = "latar_";

const ALLOWED_KEYS = [
  "latar_brand_name",
  "latar_logo_url",
  "latar_hero_bg_url",
  "latar_about_image_url",
  "latar_hero_headline",
  "latar_hero_subheadline",
  "latar_cta_reservasi_link",
  "latar_about_story",
  "latar_visi",
  "latar_misi",
  "latar_address",
  "latar_phone",
  "latar_whatsapp",
  "latar_email",
  "latar_hours",
  "latar_maps_embed",
  "latar_social_instagram",
  "latar_social_tiktok",
  "latar_social_facebook",
  "latar_testimonials",
  "latar_gallery",
];

const DEFAULT_VALUES: Record<string, { value: string; label: string }> = {
  latar_brand_name: { value: "Cafe & Resto LSP", label: "Nama Brand" },
  latar_logo_url: { value: "/LogoPrimkoppol.png", label: "Logo URL" },
  latar_hero_bg_url: { value: "/images/hero-bg.webp", label: "Hero Background URL" },
  latar_about_image_url: { value: "/images/brand-story.webp", label: "Tentang Kami Image URL" },
  latar_hero_headline: { value: "Cita Rasa Autentik di Setiap Sudut Latar.", label: "Hero Headline" },
  latar_hero_subheadline: { value: "Nikmati sajian istimewa mulai dari Nasi Goreng rempah hingga Ice Americano segar, dengan suasana yang membuat Anda betah berlama-lama.", label: "Hero Sub-headline" },
  latar_cta_reservasi_link: { value: "", label: "Link Reservasi (WhatsApp/URL)" },
  latar_about_story: { value: "Cafe Latar adalah unit bisnis unggulan Koperasi PRIMKOPPOL Resor Lumajang yang menyajikan kuliner nusantara dan aneka kopi pilihan.\n\nDengan dukungan sistem Point of Sales termutakhir, setiap pengalaman makan di Latar dirancang untuk memberikan kenyamanan dan kepuasan maksimal.", label: "Tentang Kami (Brand Story)" },
  latar_visi: { value: "Menjadi destinasi kuliner dan kopi nomor satu yang mengedepankan kualitas dan pemberdayaan ekonomi koperasi.", label: "Visi" },
  latar_misi: { value: JSON.stringify(["Menyajikan hidangan dari bahan-bahan segar berkualitas tinggi", "Berinovasi dalam menu untuk memberikan pengalaman kuliner yang unik", "Memberikan pelayanan berstandar modern dengan teknologi terkini", "Memberdayakan ekonomi anggota koperasi melalui unit usaha yang berkelanjutan"]), label: "Misi (JSON Array)" },
  latar_address: { value: "Jl. Raya Lumajang, Kab. Lumajang, Jawa Timur", label: "Alamat Lengkap" },
  latar_phone: { value: "", label: "Nomor Telepon" },
  latar_whatsapp: { value: "", label: "Nomor WhatsApp" },
  latar_email: { value: "kasirresto@koperasi.com", label: "Email" },
  latar_hours: { value: "Senin - Minggu: 09:00 - 22:00", label: "Jam Operasional" },
  latar_maps_embed: { value: "", label: "Google Maps Embed URL" },
  latar_social_instagram: { value: "", label: "Instagram URL" },
  latar_social_tiktok: { value: "", label: "TikTok URL" },
  latar_social_facebook: { value: "", label: "Facebook URL" },
  latar_testimonials: { value: JSON.stringify([
    { name: "Budi Santoso", rating: 5, text: "Ayam bakar bumbu rujak khas Latar benar-benar bikin ketagihan!", role: "Pelanggan Setia" },
    { name: "Sari Dewi", rating: 5, text: "Ice Americano-nya juara! Suasana cafe-nya juga sangat estetik.", role: "Coffee Lover" },
  ]), label: "Testimonial (JSON Array)" },
  latar_gallery: { value: JSON.stringify([]), label: "Galeri Foto (JSON Array)" },
};

// GET: Fetch all latar_* settings
export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({
      where: { key: { startsWith: LATAR_PREFIX } },
      orderBy: { key: "asc" },
    });

    // Merge with defaults for missing keys
    const result: Record<string, { id?: number; key: string; value: string; label: string }> = {};
    for (const key of ALLOWED_KEYS) {
      const existing = settings.find((s) => s.key === key);
      if (existing) {
        result[key] = {
          id: existing.id,
          key: existing.key,
          value: existing.value,
          label: DEFAULT_VALUES[key]?.label || key,
        };
      } else {
        result[key] = {
          key,
          value: DEFAULT_VALUES[key]?.value || "",
          label: DEFAULT_VALUES[key]?.label || key,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/resto/website-settings error:", error);
    return NextResponse.json({ error: "Gagal memuat pengaturan website" }, { status: 500 });
  }
}

// PUT: Upsert multiple settings
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Format tidak valid" }, { status: 400 });
    }

    // Validate all keys have the latar_ prefix and are allowed
    const entries = Object.entries(settings);
    for (const [key] of entries) {
      if (!key.startsWith(LATAR_PREFIX) || !ALLOWED_KEYS.includes(key)) {
        return NextResponse.json({ error: `Key tidak diizinkan: ${key}` }, { status: 400 });
      }
    }

    // Upsert each setting
    const upserts = entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: {
          key,
          value: String(value),
          label: DEFAULT_VALUES[key]?.label || key,
        },
      })
    );

    await prisma.$transaction(upserts);

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    console.error("PUT /api/resto/website-settings error:", error);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
