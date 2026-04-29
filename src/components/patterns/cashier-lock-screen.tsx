"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, User } from "lucide-react";
import { toast } from "sonner";

interface CashierIdentity {
    id: number;
    username: string;
    displayName: string;
}

interface CashierLockScreenProps {
    identities: CashierIdentity[];
    onVerified: (identity: CashierIdentity) => void;
}

export function CashierLockScreen({ identities, onVerified }: CashierLockScreenProps) {
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [pin, setPin] = React.useState("");
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [error, setError] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleSelectIdentity = (id: number) => {
        setSelectedId(id);
        setPin("");
        setError("");
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleSubmit = async () => {
        if (!selectedId || !pin) return;
        setIsVerifying(true);
        setError("");

        try {
            // Verify PIN
            const verifyRes = await fetch("/api/toko/cashier-identities/verify-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identityId: selectedId, pin }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                setError(verifyData.message || "PIN salah");
                setPin("");
                return;
            }

            // Set session cookie
            const sessionRes = await fetch("/api/toko/cashier-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identityId: selectedId }),
            });

            if (!sessionRes.ok) {
                setError("Gagal mengatur sesi");
                return;
            }

            onVerified(verifyData.data);
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePinChange = (value: string) => {
        const digits = value.replace(/\D/g, "").slice(0, 6);
        setPin(digits);
        setError("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && pin.length >= 4) {
            handleSubmit();
        }
    };

    const selectedIdentity = identities.find((i) => i.id === selectedId);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Kasir POS Toko</h2>
                    <p className="text-muted-foreground">Pilih identitas dan masukkan PIN</p>
                </div>

                {/* Identity Selection Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {identities.map((identity) => (
                        <Card
                            key={identity.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedId === identity.id
                                    ? "ring-2 ring-primary border-primary bg-primary/5"
                                    : "hover:border-primary/50"
                            }`}
                            onClick={() => handleSelectIdentity(identity.id)}
                        >
                            <CardContent className="p-4 flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    selectedId === identity.id ? "bg-primary text-primary-foreground" : "bg-muted"
                                }`}>
                                    <User className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-medium text-center">{identity.displayName}</span>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {identities.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        <p>Belum ada identitas kasir yang terdaftar.</p>
                        <p className="text-sm mt-1">Hubungi Admin Toko untuk menambahkan kasir.</p>
                    </div>
                )}

                {/* PIN Input */}
                {selectedId && (
                    <div className="space-y-3">
                        <div className="text-center text-sm text-muted-foreground">
                            Masukkan PIN untuk <strong>{selectedIdentity?.displayName}</strong>
                        </div>
                        <div className="flex justify-center">
                            <Input
                                ref={inputRef}
                                type="password"
                                inputMode="numeric"
                                placeholder="• • • •"
                                value={pin}
                                onChange={(e) => handlePinChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="text-center text-2xl tracking-[0.5em] w-48 h-14 font-mono"
                                maxLength={6}
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="text-center text-sm text-destructive">{error}</p>
                        )}
                        <div className="flex justify-center">
                            <Button
                                onClick={handleSubmit}
                                disabled={pin.length < 4 || isVerifying}
                                className="w-48"
                            >
                                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
