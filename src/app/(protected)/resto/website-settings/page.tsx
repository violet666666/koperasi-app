"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Save, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SettingItem {
  id?: number;
  key: string;
  value: string;
  label: string;
}

interface Testimonial {
  name: string;
  rating: number;
  text: string;
  role?: string;
}

type TabKey = "umum" | "tentang" | "kontak" | "social" | "testimonial";

const TABS: { key: TabKey; label: string }[] = [
  { key: "umum", label: "Umum" },
  { key: "tentang", label: "Tentang Kami" },
  { key: "kontak", label: "Kontak & Lokasi" },
  { key: "social", label: "Social Media" },
  { key: "testimonial", label: "Testimonial" },
];

export default function WebsiteSettingsPage() {
  const [settings, setSettings] = useState<Record<string, SettingItem>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("umum");
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/resto/website-settings");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      toast.error("Gagal memuat pengaturan website");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateValue = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [key, item] of Object.entries(settings)) {
        payload[key] = item.value;
      }

      const res = await fetch("/api/resto/website-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan");
      }

      toast.success("Pengaturan website berhasil disimpan!");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  // Testimonial helpers
  const getTestimonials = (): Testimonial[] => {
    try {
      return JSON.parse(settings["latar_testimonials"]?.value || "[]");
    } catch {
      return [];
    }
  };

  const setTestimonials = (testimonials: Testimonial[]) => {
    updateValue("latar_testimonials", JSON.stringify(testimonials));
  };

  const addTestimonial = () => {
    const current = getTestimonials();
    setTestimonials([...current, { name: "", rating: 5, text: "", role: "" }]);
  };

  const removeTestimonial = (index: number) => {
    const current = getTestimonials();
    setTestimonials(current.filter((_, i) => i !== index));
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: string | number) => {
    const current = getTestimonials();
    current[index] = { ...current[index], [field]: value };
    setTestimonials(current);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const val = (key: string) => settings[key]?.value || "";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Globe size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Website Settings</h1>
            <p className="text-sm text-gray-500">Kelola konten website company profile Latar Cafe & Resto</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Perubahan
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? "bg-white border border-b-white border-gray-200 text-orange-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {activeTab === "umum" && (
          <>
            <FieldInput label="Hero Headline" value={val("latar_hero_headline")} onChange={(v) => updateValue("latar_hero_headline", v)} />
            <FieldTextarea label="Hero Sub-headline" value={val("latar_hero_subheadline")} onChange={(v) => updateValue("latar_hero_subheadline", v)} rows={3} />
            <FieldInput label="Link Reservasi (WhatsApp URL)" value={val("latar_cta_reservasi_link")} onChange={(v) => updateValue("latar_cta_reservasi_link", v)} placeholder="https://wa.me/628xxxx" />
            {val("latar_cta_reservasi_link") && (
              <a href={val("latar_cta_reservasi_link")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline">
                <ExternalLink size={14} /> Preview Link
              </a>
            )}
          </>
        )}

        {activeTab === "tentang" && (
          <>
            <FieldTextarea label="Brand Story (Tentang Kami)" value={val("latar_about_story")} onChange={(v) => updateValue("latar_about_story", v)} rows={6} helpText="Pisahkan paragraf dengan baris kosong." />
            <FieldTextarea label="Visi" value={val("latar_visi")} onChange={(v) => updateValue("latar_visi", v)} rows={3} />
            <FieldTextarea
              label="Misi (satu poin per baris)"
              value={(() => {
                try { return JSON.parse(val("latar_misi")).join("\n"); } catch { return val("latar_misi"); }
              })()}
              onChange={(v) => updateValue("latar_misi", JSON.stringify(v.split("\n").filter((line: string) => line.trim())))}
              rows={5}
              helpText="Tulis satu misi per baris. Sistem akan menyimpannya sebagai daftar."
            />
          </>
        )}

        {activeTab === "kontak" && (
          <>
            <FieldTextarea label="Alamat Lengkap" value={val("latar_address")} onChange={(v) => updateValue("latar_address", v)} rows={2} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldInput label="Nomor Telepon" value={val("latar_phone")} onChange={(v) => updateValue("latar_phone", v)} placeholder="0331-xxxxxxx" />
              <FieldInput label="WhatsApp" value={val("latar_whatsapp")} onChange={(v) => updateValue("latar_whatsapp", v)} placeholder="628xxxxxxxxxx" />
            </div>
            <FieldInput label="Email" value={val("latar_email")} onChange={(v) => updateValue("latar_email", v)} />
            <FieldInput label="Jam Operasional" value={val("latar_hours")} onChange={(v) => updateValue("latar_hours", v)} />
            <FieldInput label="Google Maps Embed URL" value={val("latar_maps_embed")} onChange={(v) => updateValue("latar_maps_embed", v)} placeholder="https://www.google.com/maps/embed?pb=..." helpText="Buka Google Maps → Share → Embed a map → Salin URL dari src='...'" />
          </>
        )}

        {activeTab === "social" && (
          <>
            <FieldInput label="Instagram URL" value={val("latar_social_instagram")} onChange={(v) => updateValue("latar_social_instagram", v)} placeholder="https://instagram.com/latar.cafe" />
            <FieldInput label="TikTok URL" value={val("latar_social_tiktok")} onChange={(v) => updateValue("latar_social_tiktok", v)} placeholder="https://tiktok.com/@latarcafe" />
            <FieldInput label="Facebook URL" value={val("latar_social_facebook")} onChange={(v) => updateValue("latar_social_facebook", v)} placeholder="https://facebook.com/latarcafe" />
          </>
        )}

        {activeTab === "testimonial" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Kelola testimonial yang tampil di website.</p>
              <button
                onClick={addTestimonial}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <Plus size={14} /> Tambah Testimonial
              </button>
            </div>

            <div className="space-y-4">
              {getTestimonials().map((t, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Testimonial #{i + 1}</span>
                    <button onClick={() => removeTestimonial(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nama</label>
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => updateTestimonial(i, "name", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Peran / Label</label>
                      <input
                        type="text"
                        value={t.role || ""}
                        onChange={(e) => updateTestimonial(i, "role", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        placeholder="Pelanggan Setia"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rating (1-5)</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateTestimonial(i, "rating", star)}
                          className={`text-lg ${star <= t.rating ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ulasan</label>
                    <textarea
                      value={t.text}
                      onChange={(e) => updateTestimonial(i, "text", e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                    />
                  </div>
                </div>
              ))}
              {getTestimonials().length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">Belum ada testimonial. Klik "Tambah Testimonial" untuk menambahkan.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div className="fixed bottom-4 right-4 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 z-50">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Ada perubahan belum disimpan
        </div>
      )}
    </div>
  );
}

// === Reusable Field Components ===

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  rows = 4,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
      />
      {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
    </div>
  );
}
