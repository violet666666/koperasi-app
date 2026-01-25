"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    CreditCard,
    Search,
    Printer,
    Download,
    User,
    Building2,
    QrCode,
} from "lucide-react";

interface MemberCard {
    id: number;
    memberNo: string;
    name: string;
    nrp: string;
    rank: string;
    unit: string;
    joinDate: string;
    photoUrl: string;
    branchName: string;
}

export default function KartuAnggotaPage() {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [member, setMember] = React.useState<MemberCard | null>(null);
    const [isSearching, setIsSearching] = React.useState(false);

    // Search member
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock data
            setMember({
                id: 1,
                memberNo: "A-001",
                name: "AKBP Budi Santoso, S.I.K.",
                nrp: "75020458",
                rank: "AKBP",
                unit: "Polda Metro Jaya",
                joinDate: "2010-03-15",
                photoUrl: "",
                branchName: "Kantor Pusat",
            });
        } catch (error) {
            toast.error("Anggota tidak ditemukan");
        } finally {
            setIsSearching(false);
        }
    };

    // Print card
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kartu Anggota"
                description="Cetak kartu anggota koperasi"
            />

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Cari no. anggota atau NRP..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching}>
                            <Search className="mr-2 h-4 w-4" />
                            Cari
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isSearching ? (
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            ) : member ? (
                <>
                    {/* Card Preview */}
                    <div className="flex justify-center">
                        <div
                            id="member-card"
                            className="w-[400px] bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 rounded-xl p-6 text-white shadow-2xl relative overflow-hidden print:shadow-none"
                        >
                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                            </div>

                            {/* Header */}
                            <div className="relative flex items-center gap-3 mb-4 pb-4 border-b border-white/20">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">PRIMKOPPOL</h3>
                                    <p className="text-xs text-white/70">Polda Metro Jaya</p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="relative flex gap-4">
                                {/* Photo */}
                                <div className="w-24 h-28 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden">
                                    {member.photoUrl ? (
                                        <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-12 w-12 text-white/50" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 space-y-1">
                                    <div>
                                        <p className="text-xs text-white/60">Nama</p>
                                        <p className="font-bold text-sm">{member.name}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-xs text-white/60">No. Anggota</p>
                                            <p className="font-mono text-sm">{member.memberNo}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/60">NRP</p>
                                            <p className="font-mono text-sm">{member.nrp}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-white/60">Pangkat/Unit</p>
                                        <p className="text-sm">{member.rank} - {member.unit}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="relative mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-white/60">Terdaftar Sejak</p>
                                    <p className="text-sm">{new Date(member.joinDate).toLocaleDateString("id-ID", {
                                        day: "numeric", month: "long", year: "numeric"
                                    })}</p>
                                </div>
                                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                                    <QrCode className="h-12 w-12 text-blue-900" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-center gap-4 print:hidden">
                        <Button onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak Kartu
                        </Button>
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                </>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">Cari Anggota</h3>
                        <p className="mt-2 text-muted-foreground">
                            Masukkan nomor anggota atau NRP untuk mencetak kartu
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #member-card, #member-card * {
                        visibility: visible;
                    }
                    #member-card {
                        position: fixed;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                    }
                }
            `}</style>
        </div>
    );
}
