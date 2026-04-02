"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [error, setError] = React.useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // TODO: Implement password reset API
            // For now, just simulate a delay
            await new Promise((resolve) => setTimeout(resolve, 1000));
            setIsSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            {/* Logo & Branding */}
            <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
                    K
                </div>
                <h1 className="text-2xl font-bold text-foreground">PRIMKOPPOL RESOR LUMAJANG</h1>
                <p className="text-sm text-muted-foreground">Reset Password</p>
            </div>

            {/* Forgot Password Card */}
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl">Lupa Password</CardTitle>
                    <CardDescription>
                        Masukkan email Anda untuk menerima link reset password
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSubmitted ? (
                        <div className="text-center space-y-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Cek Email Anda</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Jika email terdaftar, Anda akan menerima link reset password.
                                </p>
                            </div>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Kembali ke Login
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Error Alert */}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="nama@primkoppol.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Submit Button */}
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    "Kirim Link Reset"
                                )}
                            </Button>

                            {/* Back to Login */}
                            <Button asChild variant="ghost" className="w-full">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Kembali ke Login
                                </Link>
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-muted-foreground">
                © 2025 PRIMKOPPOL RESOR LUMAJANG. All rights reserved.
            </p>
        </main>
    );
}
