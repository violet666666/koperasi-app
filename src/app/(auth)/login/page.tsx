"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const { login, isAuthenticated, isLoading: authLoading } = useAuth();

    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    // Redirect if already authenticated
    React.useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.push("/dashboard");
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading while checking auth
    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            {/* Logo & Branding */}
            <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
                    K
                </div>
                <h1 className="text-2xl font-bold text-foreground">Koperasi Digital</h1>
                <p className="text-sm text-muted-foreground">Sistem Manajemen Koperasi Simpan Pinjam</p>
            </div>

            {/* Login Card */}
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl">Masuk</CardTitle>
                    <CardDescription>
                        Masukkan email dan password untuk melanjutkan
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                placeholder="nama@koperasi.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-primary hover:underline"
                                >
                                    Lupa password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                "Masuk"
                            )}
                        </Button>
                    </form>

                    {/* Demo Credentials */}
                    <div className="mt-6 rounded-lg bg-muted p-4 text-sm" role="note" aria-label="Demo credentials">
                        <p className="font-medium text-foreground mb-2">Demo Credentials:</p>
                        <p className="text-sm text-foreground/80">
                            Email: <code className="bg-background px-1 rounded font-mono">admin@koperasi.com</code>
                        </p>
                        <p className="text-sm text-foreground/80">
                            Password: <code className="bg-background px-1 rounded font-mono">admin123</code>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-muted-foreground">
                © 2025 Koperasi Digital. All rights reserved.
            </p>
        </main>
    );
}
