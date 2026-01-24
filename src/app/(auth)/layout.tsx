import { AuthProvider } from "@/lib/hooks";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthProvider>{children}</AuthProvider>;
}
