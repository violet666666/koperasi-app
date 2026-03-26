import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PRIMKOPPOL LUMAJANG",
    template: "%s | PRIMKOPPOL LUMAJANG",
  },
  description: "Sistem Manajemen Koperasi Simpan Pinjam",
  keywords: ["koperasi", "simpan pinjam", "anggota", "pinjaman", "simpanan"],
  authors: [{ name: "PRIMKOPPOL LUMAJANG" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koperasi",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "PRIMKOPPOL LUMAJANG",
    description: "Sistem Informasi Manajemen PRIMKOPPOL LUMAJANG",
    url: "https://koperasi.xertusai.com",
    siteName: "PRIMKOPPOL LUMAJANG",
    images: [
      {
        url: "/og-image-primkoppol.png",
        width: 1200,
        height: 630,
        alt: "PRIMKOPPOL LUMAJANG",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PRIMKOPPOL LUMAJANG",
    description: "Sistem Informasi Manajemen PRIMKOPPOL LUMAJANG",
    images: ["/og-image-primkoppol.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B2A4A" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <QueryProvider>
            {children}
            <PwaInstallPrompt />
          </QueryProvider>
          <Toaster position="top-right" richColors />
        </SessionProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

