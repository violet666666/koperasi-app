"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, Printer } from "lucide-react";
import { memberLookupApi } from "@/lib/api/services";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";

interface MemberDetail {
    id: number;
    memberNo: string;
    nrp?: string;
    name: string;
    phone?: string;
    category?: string;
    status: string;
    joinDate?: string;
    branch?: { id: number; name: string };
}

export default function KartuAnggotaPage() {
    const [isSearching, setIsSearching] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [member, setMember] = React.useState<MemberDetail | null>(null);
    const barcodeRef = React.useRef<SVGSVGElement>(null);

    // Generate barcode when member changes
    React.useEffect(() => {
        if (member && barcodeRef.current) {
            try {
                JsBarcode(barcodeRef.current, member.memberNo, {
                    format: "CODE128",
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 14,
                    margin: 5,
                    textMargin: 3,
                });
            } catch (err) {
                console.error("Barcode generation error:", err);
            }
        }
    }, [member]);

    const searchMember = async () => {
        if (!searchQuery.trim()) {
            toast.error("Masukkan NRP anggota");
            return;
        }

        setIsSearching(true);
        try {
            const response = await memberLookupApi.byNrp(searchQuery);
            if (response.data) {
                const apiData = response.data as unknown as MemberDetail;
                setMember(apiData);
                toast.success("Anggota ditemukan");
            } else {
                toast.error("Anggota tidak ditemukan");
                setMember(null);
            }
        } catch {
            toast.error("Anggota tidak ditemukan");
            setMember(null);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            searchMember();
        }
    };

    const handlePrintCard = () => {
        if (!member) return;
        setIsPrinting(true);

        try {
            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [86, 54], // Credit card size
            });

            const cardWidth = 86;
            const cardHeight = 54;

            // Background
            doc.setFillColor(25, 45, 100);
            doc.rect(0, 0, cardWidth, cardHeight, "F");

            // Top accent
            doc.setFillColor(41, 65, 148);
            doc.rect(0, 0, cardWidth, 14, "F");

            // Title
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("KOPERASI PRIMKOPPOL", cardWidth / 2, 6, { align: "center" });
            doc.setFontSize(6);
            doc.setFont("helvetica", "normal");
            doc.text("POLRES LUMAJANG", cardWidth / 2, 10, { align: "center" });

            // Separator line
            doc.setDrawColor(200, 200, 255);
            doc.setLineWidth(0.3);
            doc.line(5, 15, cardWidth - 5, 15);

            // Member info
            doc.setTextColor(220, 230, 255);
            doc.setFontSize(6);
            doc.text("KARTU ANGGOTA", 5, 19);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(member.name, 5, 25);

            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(200, 210, 240);

            let yPos = 30;
            doc.text(`No. Anggota: ${member.memberNo}`, 5, yPos);
            yPos += 4;
            if (member.category) {
                doc.text(`Kategori: ${member.category}`, 5, yPos);
            }

            // Barcode
            if (barcodeRef.current) {
                const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const img = new Image();

                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    if (ctx) {
                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    }
                    const imgData = canvas.toDataURL("image/png");

                    const barcodeWidth = 40;
                    const barcodeHeight = 15;
                    doc.setFillColor(255, 255, 255);
                    doc.roundedRect(cardWidth - barcodeWidth - 5, cardHeight - barcodeHeight - 5, barcodeWidth + 2, barcodeHeight + 2, 1, 1, "F");
                    doc.addImage(imgData, "PNG", cardWidth - barcodeWidth - 4, cardHeight - barcodeHeight - 4, barcodeWidth, barcodeHeight);

                    doc.save(`Kartu_Anggota_${member.memberNo}.pdf`);
                    setIsPrinting(false);
                    toast.success("Kartu anggota berhasil dicetak");
                };

                img.onerror = () => {
                    doc.save(`Kartu_Anggota_${member.memberNo}.pdf`);
                    setIsPrinting(false);
                    toast.success("Kartu anggota berhasil dicetak");
                };

                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
            } else {
                doc.save(`Kartu_Anggota_${member.memberNo}.pdf`);
                setIsPrinting(false);
                toast.success("Kartu anggota berhasil dicetak");
            }
        } catch (error) {
            console.error("Print error:", error);
            toast.error("Gagal mencetak kartu anggota");
            setIsPrinting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kartu Anggota"
                description="Cetak kartu anggota dengan barcode untuk identifikasi member"
                backHref="/anggota"
            />

            {/* Search */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Cari Anggota</CardTitle>
                    <CardDescription>Masukkan NRP untuk mencari anggota</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 max-w-md">
                        <div className="flex-1">
                            <Label htmlFor="search" className="sr-only">NRP</Label>
                            <Input
                                id="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Masukkan NRP..."
                            />
                        </div>
                        <Button onClick={searchMember} disabled={isSearching || !searchQuery.trim()}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" />Cari</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Card Preview */}
            {member && (
                <div className="space-y-6">
                    <div className="flex flex-col items-center gap-6">
                        <h3 className="text-lg font-semibold">Preview Kartu Anggota</h3>

                        {/* Physical card preview */}
                        <div className="relative w-[430px] h-[270px] rounded-2xl overflow-hidden shadow-2xl"
                            style={{ background: "linear-gradient(135deg, #192d64 0%, #294194 40%, #1a3478 100%)" }}>
                            {/* Top accent */}
                            <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center"
                                style={{ background: "linear-gradient(180deg, rgba(41,65,148,0.9) 0%, transparent 100%)" }}>
                                <div className="text-center">
                                    <h4 className="text-white font-bold text-[15px] tracking-wide">KOPERASI PRIMKOPPOL</h4>
                                    <p className="text-blue-200 text-[10px] tracking-widest">POLRES LUMAJANG</p>
                                </div>
                            </div>

                            {/* Decorative circle */}
                            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10"
                                style={{ background: "radial-gradient(circle, white, transparent)" }} />

                            <div className="absolute top-[65px] left-0 right-0 px-6">
                                <div className="w-full h-[0.5px] bg-blue-300/30" />
                            </div>

                            {/* Card body */}
                            <div className="absolute top-[75px] left-6 right-6">
                                <p className="text-blue-200/70 text-[9px] uppercase tracking-widest mb-1">Kartu Anggota</p>
                                <h3 className="text-white font-bold text-xl mb-3">{member.name}</h3>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-200/70 text-[10px] w-20">No. Anggota</span>
                                        <span className="text-blue-100 text-[12px] font-medium font-mono">{member.memberNo}</span>
                                    </div>
                                    {member.category && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-200/70 text-[10px] w-20">Kategori</span>
                                            <span className="text-blue-100 text-[12px] font-medium">{member.category}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Barcode area */}
                            <div className="absolute bottom-4 right-4 bg-white rounded-lg p-1.5 shadow-lg">
                                <svg ref={barcodeRef} className="w-[160px] h-[55px]" />
                            </div>

                            {/* Status badge */}
                            <div className="absolute bottom-4 left-6">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-semibold tracking-wide uppercase ${
                                    member.status === "active"
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                                }`}>
                                    {member.status === "active" ? "● AKTIF" : "● NON-AKTIF"}
                                </span>
                            </div>
                        </div>

                        {/* Print button */}
                        <Button onClick={handlePrintCard} disabled={isPrinting} size="lg">
                            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            Cetak Kartu (PDF)
                        </Button>
                    </div>

                    {/* Member Details */}
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle className="text-lg">Detail Anggota</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                ["Nama", member.name],
                                ["No. Anggota", member.memberNo],
                                ["Kategori", member.category || "-"],
                                ["Telepon", member.phone || "-"],
                                ["Status", member.status === "active" ? "Aktif" : "Non-Aktif"],
                            ].map(([label, value]) => (
                                <div key={label} className="grid grid-cols-3 gap-2 py-1 border-b last:border-0">
                                    <span className="text-sm text-muted-foreground">{label}</span>
                                    <span className="col-span-2 font-medium">{value}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Empty state */}
            {!member && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="text-lg font-medium">Cari anggota untuk melihat kartu</p>
                    <p className="text-sm">Masukkan NRP untuk menampilkan dan mencetak kartu anggota</p>
                </div>
            )}
        </div>
    );
}
