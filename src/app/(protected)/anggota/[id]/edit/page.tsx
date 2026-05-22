"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, CalendarIcon } from "lucide-react";
import { membersApi } from "@/lib/api/services";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getProvinceNames, getCitiesByProvince } from "@/lib/constants/regions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EditAnggotaPage() {
    const router = useRouter();
    const params = useParams();
    const memberId = Number(params.id);

    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showNrpDialog, setShowNrpDialog] = React.useState(false);
    const [pendingNrp, setPendingNrp] = React.useState("");
    const [originalNrp, setOriginalNrp] = React.useState("");

    const [activeRoles, setActiveRoles] = React.useState<{ id: number; name: string; displayName: string }[]>([]);

    const [formData, setFormData] = React.useState({
        name: "",
        memberNo: "",
        nrp: "",
        nik: "",
        gender: "",
        category: "",
        salary: "",
        tunlesKinerja: "",
        sisaGaji: "",
        tabunganWajib: "",
        birthPlace: "",
        birthDate: "",
        maritalStatus: "",
        religion: "",
        education: "",
        pangkat: "",
        golongan: "",
        kesatuan: "",
        employeeType: "",
        noRekening: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postalCode: "",
        plafonPiutang: "",
        roleId: "",
        spBalance: "",
        swBalance: "",
        ssBalance: "",
    });

    React.useEffect(() => {
        if (!memberId) return;
        async function load() {
            setIsLoading(true);
            try {
                const res = await membersApi.get(memberId);
                const m = (res.data as any).data || res.data;
                const mData = m.data ? m.data : m; // Adjust depending on response structure
                const roles = res.data?.meta?.roles || [];
                setActiveRoles(roles);

                setOriginalNrp(mData.nrp || "");
                const getBal = (type: string) => {
                    if (!mData.savingsAccounts) return "0";
                    const acc = mData.savingsAccounts.find((a: any) => a.product?.type === type);
                    return acc ? String(acc.balance) : "0";
                };
                setFormData({
                    name: mData.name || "",
                    memberNo: mData.memberNo || "",
                    nrp: mData.nrp || "",
                    nik: mData.nik || "",
                    gender: mData.gender || "",
                    category: mData.category || "",
                    salary: mData.salary ? String(mData.salary) : "",
                    tunlesKinerja: mData.tunlesKinerja ? String(mData.tunlesKinerja) : "",
                    sisaGaji: mData.sisaGaji ? String(mData.sisaGaji) : "",
                    tabunganWajib: mData.tabunganWajib ? String(mData.tabunganWajib) : "",
                    birthPlace: mData.birthPlace || "",
                    birthDate: mData.birthDate ? mData.birthDate.split("T")[0] : "",
                    maritalStatus: mData.maritalStatus || "",
                    religion: mData.religion || "",
                    education: mData.education || "",
                    pangkat: mData.pangkat || "",
                    golongan: mData.golongan || "",
                    kesatuan: mData.kesatuan || "",
                    employeeType: mData.employeeType || "",
                    noRekening: mData.noRekening || "",
                    phone: mData.phone || "",
                    email: mData.email || "",
                    address: mData.address || "",
                    city: mData.city || "",
                    province: mData.province || "",
                    postalCode: mData.postalCode || "",
                    plafonPiutang: mData.plafonPiutang ? String(mData.plafonPiutang) : "0",
                    roleId: mData.userAccount?.roleId ? String(mData.userAccount.roleId) : "",
                    spBalance: getBal('pokok'),
                    swBalance: getBal('wajib'),
                    ssBalance: getBal('sukarela'),
                });
            } catch {
                toast.error("Gagal memuat data anggota");
                router.push("/anggota");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [memberId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === "province") {
            setFormData((prev) => ({ ...prev, province: value, city: "" }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleDateChange = (name: string, date: Date | undefined) => {
        if (date) {
            const offset = date.getTimezoneOffset();
            const adjusted = new Date(date.getTime() - offset * 60 * 1000);
            setFormData((prev) => ({ ...prev, [name]: adjusted.toISOString().split("T")[0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if NRP changed
        const newNrp = formData.nrp.trim();
        if (newNrp !== originalNrp && newNrp !== "") {
            setPendingNrp(newNrp);
            setShowNrpDialog(true);
            return;
        }

        await doSubmit();
    };

    const doSubmit = async () => {
        setIsSaving(true);
        try {
            const payload: Record<string, any> = { ...formData };
            delete payload.spBalance;
            delete payload.swBalance;
            delete payload.ssBalance;

            Object.keys(payload).forEach((key) => {
                if (payload[key] === "") delete payload[key];
            });

            // Re-mount numeric fields
            if (payload.roleId) payload.roleId = Number(payload.roleId);

            payload.overrideSavings = {
                pokok: Number(formData.spBalance || 0),
                wajib: Number(formData.swBalance || 0),
                sukarela: Number(formData.ssBalance || 0),
            };

            await membersApi.update(memberId, payload);
            toast.success("Data anggota berhasil diperbarui");
            router.push(`/anggota/${memberId}`);
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Gagal memperbarui data anggota";
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const provinces = getProvinceNames();
    const cities = formData.province ? getCitiesByProvince(formData.province) : [];

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-3xl">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Data Anggota"
                description="Perbarui informasi lengkap anggota PRIMKOPPOL"
                backHref={`/anggota/${memberId}`}
            />

            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
                {/* Data Pribadi */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Data Pribadi</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="name">Nama Lengkap *</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                        </div>

                        <div>
                            <Label htmlFor="memberNo">Nomor Anggota Koperasi (ID)</Label>
                            <Input id="memberNo" name="memberNo" value={formData.memberNo} onChange={handleChange} placeholder="Misal: 001/PBL/123" />
                        </div>

                        <div>
                            <Label htmlFor="nrp">NRP / NIP</Label>
                            <Input id="nrp" name="nrp" value={formData.nrp} onChange={handleChange} placeholder="Nomor Registrasi Pokok / NIP" />
                        </div>

                        <div>
                            <Label htmlFor="nik">NIK</Label>
                            <Input id="nik" name="nik" value={formData.nik} onChange={handleChange} maxLength={16} placeholder="16 digit NIK" />
                        </div>

                        <div>
                            <Label>Jenis Kelamin</Label>
                            <Select value={formData.gender} onValueChange={(v) => handleSelectChange("gender", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Laki-laki</SelectItem>
                                    <SelectItem value="female">Perempuan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="category">Kategori Anggota</Label>
                            <Input 
                                id="category" 
                                list="category-options" 
                                name="category" 
                                value={formData.category} 
                                onChange={handleChange} 
                                placeholder="Pilih atau ketik kategori baru" 
                            />
                            <datalist id="category-options">
                                <option value="AKBP" />
                                <option value="KOMPOL" />
                                <option value="AKP" />
                                <option value="IPTU" />
                                <option value="IPDA" />
                                <option value="AIPTU" />
                                <option value="AIPDA" />
                                <option value="BRIPKA" />
                                <option value="BRIGADIR" />
                                <option value="BRIPTU" />
                                <option value="BRIPDA" />
                                <option value="PNS" />
                                <option value="PHL" />
                                <option value="Purnawirawan" />
                                <option value="Polri" />
                                <option value="Karyawan" />
                            </datalist>
                        </div>

                        <div>
                            <Label htmlFor="salary">Gaji Bersih (Per Bulan)</Label>
                            <Input
                                id="salary"
                                name="salary"
                                type="number"
                                min="0"
                                value={formData.salary}
                                onChange={handleChange}
                                placeholder="Masukkan nominal gaji bersih"
                            />
                        </div>

                        <div>
                            <Label>Status Pernikahan</Label>
                            <Select value={formData.maritalStatus} onValueChange={(v) => handleSelectChange("maritalStatus", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Belum Menikah</SelectItem>
                                    <SelectItem value="married">Menikah</SelectItem>
                                    <SelectItem value="divorced">Cerai</SelectItem>
                                    <SelectItem value="widowed">Janda/Duda</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Tempat Lahir</Label>
                            <Input name="birthPlace" value={formData.birthPlace} onChange={handleChange} placeholder="Kota tempat lahir" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Tanggal Lahir</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !formData.birthDate && "text-muted-foreground")}>
                                        {formData.birthDate ? format(new Date(formData.birthDate), "PPP", { locale: localeId }) : <span>Pilih tanggal</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.birthDate ? new Date(formData.birthDate) : undefined}
                                        onSelect={(d) => handleDateChange("birthDate", d)}
                                        disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <Label>Agama</Label>
                            <Select value={formData.religion} onValueChange={(v) => handleSelectChange("religion", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="islam">Islam</SelectItem>
                                    <SelectItem value="kristen">Kristen</SelectItem>
                                    <SelectItem value="katolik">Katolik</SelectItem>
                                    <SelectItem value="hindu">Hindu</SelectItem>
                                    <SelectItem value="buddha">Buddha</SelectItem>
                                    <SelectItem value="konghucu">Konghucu</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Pendidikan</Label>
                            <Select value={formData.education} onValueChange={(v) => handleSelectChange("education", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sd">SD</SelectItem>
                                    <SelectItem value="smp">SMP</SelectItem>
                                    <SelectItem value="sma">SMA/SMK</SelectItem>
                                    <SelectItem value="d3">D3</SelectItem>
                                    <SelectItem value="s1">S1</SelectItem>
                                    <SelectItem value="s2">S2</SelectItem>
                                    <SelectItem value="s3">S3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Pangkat</Label>
                            <Input name="pangkat" value={formData.pangkat} onChange={handleChange} placeholder="Contoh: IPTU" />
                        </div>

                        <div>
                            <Label>Golongan</Label>
                            <Input name="golongan" value={formData.golongan} onChange={handleChange} placeholder="Contoh: III/b" />
                        </div>

                        <div>
                            <Label>Kesatuan</Label>
                            <Input name="kesatuan" value={formData.kesatuan} onChange={handleChange} placeholder="Contoh: Sat Reskrim" />
                        </div>

                        <div>
                            <Label>Jenis Pegawai</Label>
                            <Select value={formData.employeeType} onValueChange={(v) => handleSelectChange("employeeType", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih jenis pegawai" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="organik_polri">Polri</SelectItem>
                                    <SelectItem value="pns_polri">PNS</SelectItem>
                                    <SelectItem value="purnawirawan">Purnawirawan</SelectItem>
                                    <SelectItem value="masyarakat_umum">Masyarakat Umum</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>No. Rekening BRI</Label>
                            <Input name="noRekening" value={formData.noRekening} onChange={handleChange} placeholder="15 digit" />
                        </div>

                        {activeRoles.length > 0 && formData.roleId !== undefined && (
                            <div className="sm:col-span-2 border-t pt-4 mt-2">
                                <Label className="text-blue-600 font-semibold mb-2 block">Hak Akses Sistem (Role Akun Login)</Label>
                                <Select value={formData.roleId} onValueChange={(v) => handleSelectChange("roleId", v)}>
                                    <SelectTrigger><SelectValue placeholder="Pilih Hak Akses" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">-- Tidak Memiliki Hak Akses Khusus --</SelectItem>
                                        {activeRoles.map(role => (
                                            <SelectItem key={role.id} value={String(role.id)}>{role.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">Ubah jika anggota ini menggunakan aplikasi untuk mengelola koperasi.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Data Finansial */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Setoran Bulanan (Gaji & Tabungan)</CardTitle>
                        <p className="text-sm text-muted-foreground">Konfigurasi potongan atau limit yang dikenakan pada anggota ini pada setiap periode bulanannya.</p>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="salary">Gaji Bersih (Per Bulan)</Label>
                            <Input id="salary" name="salary" type="number" min="0" value={formData.salary} onChange={handleChange} placeholder="Rp" />
                            <p className="text-[10px] text-muted-foreground mt-1">Patokan gaji untuk acuan kredit.</p>
                        </div>
                        <div>
                            <Label htmlFor="tunlesKinerja">Tunles / Tunkin (Per Bulan)</Label>
                            <Input id="tunlesKinerja" name="tunlesKinerja" type="number" min="0" value={formData.tunlesKinerja} onChange={handleChange} placeholder="Rp" />
                        </div>
                        <div>
                            <Label htmlFor="sisaGaji">Sisa Gaji (Setelah Potongan)</Label>
                            <Input id="sisaGaji" name="sisaGaji" type="number" min="0" value={formData.sisaGaji} onChange={handleChange} placeholder="Rp" />
                            <p className="text-[10px] text-muted-foreground mt-1">Rumus: Gaji Bersih − Total Potongan. Plafon piutang = 50% × Sisa Gaji (jika tidak ada plafon manual).</p>
                        </div>
                        <div>
                            <Label htmlFor="tabunganWajib">Target Setoran Wajib Per Bulan</Label>
                            <Input id="tabunganWajib" name="tabunganWajib" type="number" min="0" value={formData.tabunganWajib} onChange={handleChange} placeholder="Rp" />
                            <p className="text-[10px] text-orange-600 mt-1 font-semibold">⚠ Ini adalah TARGET BULANAN (Misal: 50.000). BUKAN total saldo saat ini!</p>
                        </div>
                        <div>
                            <Label htmlFor="plafonPiutang">Plafon Piutang Unit (Limit Kasir)</Label>
                            <Input id="plafonPiutang" name="plafonPiutang" type="number" min="0" value={formData.plafonPiutang} onChange={handleChange} placeholder="Rp" />
                            <p className="text-[10px] text-muted-foreground mt-1">Batas maksimal ngutang/kasbon di toko. Kosongkan/0 = otomatis 50% × Sisa Gaji.</p>
                            {(() => {
                                const manualPlafon = parseFloat(formData.plafonPiutang) || 0;
                                const sisaGajiVal = parseFloat(formData.sisaGaji) || 0;
                                const effectivePlafon = manualPlafon > 0 ? manualPlafon : Math.floor(sisaGajiVal * 0.5);
                                if (effectivePlafon > 0) {
                                    return (
                                        <div className="mt-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
                                            <p className="text-xs font-semibold text-blue-700">
                                                Plafon Aktif: Rp {effectivePlafon.toLocaleString("id-ID")}
                                                {manualPlafon > 0
                                                    ? " (manual)"
                                                    : ` (auto: 50% × Rp ${sisaGajiVal.toLocaleString("id-ID")})`}
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="mt-2 px-3 py-2 rounded-md bg-red-50 border border-red-200">
                                        <p className="text-xs font-semibold text-red-600">
                                            Plafon Aktif: Rp 0 — Isi Sisa Gaji atau Plafon manual agar anggota bisa bertransaksi.
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </CardContent>
                </Card>

                {/* Override Saldo Simpanan */}
                <Card className="border-orange-200 bg-orange-50/30">
                    <CardHeader>
                        <CardTitle className="text-lg text-orange-700">Penyesuaian Total Saldo Simpanan Terkini</CardTitle>
                        <p className="text-sm text-orange-600/90 font-medium">Berapa total uang tabungan anggota ini yang SEBENARNYA ada hari ini secara Real-Time?</p>
                        <p className="text-xs text-orange-600/80 mt-1 leading-relaxed">
                            Nilai di bawah ini ditarik <strong>langsung dari database (Real-Time)</strong>. Apabila saldo ini salah (misal gara-gara salah Import Excel / cacat hitung lama), silakan ganti angkanya. 
                            Sistem akan otomatis merebakannya sebagai <strong>Nota Koreksi (Auto-Correction)</strong> di riwayat transaksi anggotanya agar Saldo Dompet Pusat Koperasi tetap aman.
                        </p>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <Label htmlFor="spBalance" className="text-orange-900">Saldo Simpanan Pokok</Label>
                            <Input id="spBalance" name="spBalance" type="number" value={formData.spBalance} onChange={handleChange} className="border-orange-200" />
                        </div>
                        <div>
                            <Label htmlFor="swBalance" className="text-orange-900">Saldo Simpanan Wajib</Label>
                            <Input id="swBalance" name="swBalance" type="number" value={formData.swBalance} onChange={handleChange} className="border-orange-200" />
                        </div>
                        <div>
                            <Label htmlFor="ssBalance" className="text-orange-900">Saldo Simpanan Sukarela</Label>
                            <Input id="ssBalance" name="ssBalance" type="number" value={formData.ssBalance} onChange={handleChange} className="border-orange-200" />
                        </div>
                    </CardContent>
                </Card>

                {/* Kontak */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Kontak</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="phone">No. Telepon</Label>
                            <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
                        </div>
                    </CardContent>
                </Card>

                {/* Alamat */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Alamat</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label>Alamat Lengkap</Label>
                            <Textarea name="address" value={formData.address} onChange={handleChange} placeholder="Jl. xxx No. xx, RT/RW, Kelurahan" rows={3} />
                        </div>

                        <div>
                            <Label>Provinsi</Label>
                            <Select value={formData.province} onValueChange={(v) => handleSelectChange("province", v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {provinces.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Kota / Kabupaten</Label>
                            <Select value={formData.city} onValueChange={(v) => handleSelectChange("city", v)} disabled={!formData.province}>
                                <SelectTrigger><SelectValue placeholder={formData.province ? "Pilih kota" : "Pilih provinsi dulu"} /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {cities.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Kode Pos</Label>
                            <Input name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="12345" maxLength={5} />
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                        ) : (
                            <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>
                        )}
                    </Button>
                </div>
            </form>

            {/* NRP Change Confirmation Dialog */}
            <AlertDialog open={showNrpDialog} onOpenChange={setShowNrpDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Perubahan NRP Terdeteksi</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    NRP akan berubah dari <strong className="font-mono">{originalNrp || "(kosong)"}</strong> menjadi{" "}
                                    <strong className="font-mono">{pendingNrp}</strong>.
                                </p>
                                <p className="text-sm">Perubahan ini akan:</p>
                                <ul className="text-sm list-disc list-inside space-y-1">
                                    <li>Reset password login member ke NRP baru</li>
                                    <li>Update username login ke NRP baru</li>
                                    <li>Member harus login ulang dengan NRP baru</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowNrpDialog(false)}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                setShowNrpDialog(false);
                                await doSubmit();
                            }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Ya, Ubah NRP
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
