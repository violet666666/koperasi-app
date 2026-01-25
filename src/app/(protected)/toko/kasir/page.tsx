"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    Trash2,
    CreditCard,
    Banknote,
    Receipt,
    User,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface Product {
    id: number;
    sku: string;
    name: string;
    price: number;
    stock: number;
}

interface CartItem {
    product: Product;
    quantity: number;
}

export default function KasirPage() {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [products, setProducts] = React.useState<Product[]>([]);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [customerName, setCustomerName] = React.useState("");
    const [paymentAmount, setPaymentAmount] = React.useState("");

    // Mock products
    React.useEffect(() => {
        setProducts([
            { id: 1, sku: "BRS-001", name: "Beras Premium 5kg", price: 75000, stock: 50 },
            { id: 2, sku: "MGR-001", name: "Minyak Goreng 2L", price: 35000, stock: 15 },
            { id: 3, sku: "GLP-001", name: "Gula Pasir 1kg", price: 18000, stock: 80 },
            { id: 4, sku: "KPI-001", name: "Kopi Bubuk 250g", price: 25000, stock: 40 },
            { id: 5, sku: "TEH-001", name: "Teh Celup 25s", price: 12000, stock: 60 },
            { id: 6, sku: "SBN-001", name: "Sabun Mandi 100g", price: 8000, stock: 100 },
            { id: 7, sku: "MIE-001", name: "Mie Instan (box)", price: 120000, stock: 25 },
            { id: 8, sku: "SUS-001", name: "Susu UHT 1L", price: 18000, stock: 35 },
        ]);
    }, []);

    // Filtered products
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const change = Number(paymentAmount) - subtotal;

    // Add to cart
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    toast.error("Stok tidak mencukupi");
                    return prev;
                }
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    // Update quantity
    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return item;
            if (newQty > item.product.stock) {
                toast.error("Stok tidak mencukupi");
                return item;
            }
            return { ...item, quantity: newQty };
        }));
    };

    // Remove from cart
    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    // Process payment
    const processPayment = () => {
        if (cart.length === 0) {
            toast.error("Keranjang kosong");
            return;
        }
        if (Number(paymentAmount) < subtotal) {
            toast.error("Pembayaran kurang");
            return;
        }

        toast.success(`Transaksi berhasil! Kembalian: ${formatCurrency(change)}`);
        setCart([]);
        setPaymentAmount("");
        setCustomerName("");
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kasir / POS"
                description="Point of Sale - Penjualan toko"
            />

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Product Search */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari produk atau scan barcode..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right">Harga</TableHead>
                                            <TableHead className="text-center">Stok</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((product) => (
                                            <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => addToCart(product)}>
                                                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(product.price)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                                                        {product.stock}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Cart */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Keranjang
                                {cart.length > 0 && (
                                    <Badge variant="secondary">{cart.length} item</Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Customer */}
                            <div>
                                <Label className="text-xs">Nama Pelanggan (opsional)</Label>
                                <div className="flex gap-2 mt-1">
                                    <User className="h-4 w-4 text-muted-foreground mt-2" />
                                    <Input
                                        placeholder="Nama atau No. Anggota"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Cart Items */}
                            <div className="max-h-[250px] overflow-y-auto space-y-2">
                                {cart.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Keranjang kosong
                                    </p>
                                ) : (
                                    cart.map((item) => (
                                        <div key={item.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{item.product.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(item.product.price)} × {item.quantity}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeFromCart(item.product.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <Separator />

                            {/* Total */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Payment */}
                            <div>
                                <Label>Bayar</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="text-right text-lg font-bold"
                                />
                                {Number(paymentAmount) >= subtotal && subtotal > 0 && (
                                    <p className="text-sm text-emerald-600 mt-1">
                                        Kembalian: {formatCurrency(change)}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={processPayment} disabled={cart.length === 0}>
                                    <Banknote className="mr-2 h-4 w-4" />
                                    Bayar Tunai
                                </Button>
                            </div>
                            <Button variant="outline" className="w-full" disabled={cart.length === 0}>
                                <Receipt className="mr-2 h-4 w-4" />
                                Cetak Struk
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
