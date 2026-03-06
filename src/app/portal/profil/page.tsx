"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { memberPortalApi } from "@/lib/api/services";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Phone, MapPin, Calendar, Briefcase, Info, BadgeCheck } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";

export default function ProfilPortalPage() {
    const { user } = useAuth();

    type SummaryResponse = {
        data: { member: any };
    };

    const { data: response, isLoading } = useQuery<SummaryResponse>({
        queryKey: ["member-summary"],
        queryFn: () => memberPortalApi.summary() as Promise<SummaryResponse>,
    });

    const member = response?.data.member;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold tracking-tight mb-6">Profil Anggota</h1>

            <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-24 bg-primary" />
                <CardContent className="p-6 relative">
                    <div className="absolute -top-12 left-6 h-24 w-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                        <User className="h-12 w-12 text-slate-400" />
                    </div>

                    <div className="mt-12 mb-6">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-48" /> : member?.name}</h2>
                            {member?.status === 'active' && <BadgeCheck className="h-5 w-5 text-emerald-500" />}
                        </div>
                        <p className="text-muted-foreground">{isLoading ? <Skeleton className="h-4 w-32 mt-2" /> : `NRP: ${member?.nrp || '-'}`}</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-y-6 gap-x-12 pt-6 border-t border-slate-100">
                        {isLoading ? (
                            Array(6).fill(0).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-5 w-5 mt-0.5 rounded" />
                                    <div className="space-y-2 w-full">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                <div className="flex gap-3 text-slate-600">
                                    <Info className="h-5 w-5 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Nomor Anggota</p>
                                        <p className="font-medium text-slate-800">{member?.memberNo}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 text-slate-600">
                                    <MapPin className="h-5 w-5 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Cabang</p>
                                        <p className="font-medium text-slate-800">{member?.branch?.name}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 text-slate-600">
                                    <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Tanggal Bergabung</p>
                                        <p className="font-medium text-slate-800">
                                            {member?.joinDate ? format(new Date(member.joinDate), "d MMMM yyyy", { locale: id }) : '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 text-slate-600">
                                    <Phone className="h-5 w-5 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">No. Telepon</p>
                                        <p className="font-medium text-slate-800">{member?.phone || '-'}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 text-slate-600">
                                    <Mail className="h-5 w-5 text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Email</p>
                                        <p className="font-medium text-slate-800">{member?.email || '-'}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 text-slate-600 sm:col-span-2">
                                    <Briefcase className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Alamat Lengkap</p>
                                        <p className="font-medium text-slate-800 leading-relaxed">{member?.address || 'Alamat belum diatur'}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 flex gap-4 text-sm text-blue-800">
                <Info className="h-5 w-5 shrink-0 text-blue-500" />
                <p>
                    Data profil dikelola sepenuhnya oleh Admin Koperasi. Jika Terdapat kesalahan atau perubahan data
                    seperti nomor telepon atau alamat email, silakan hubungi pengurus koperasi di cabang Anda.
                </p>
            </div>
        </div>
    );
}
