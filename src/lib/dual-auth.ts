import { auth } from "@/lib/auth";
import { getMobileUserWithScope } from "@/app/api/mobile/middleware";

/**
 * Dual-auth untuk route web yang JUGA dipanggil aplikasi mobile.
 * Urutan: cookie session NextAuth (`auth()`) dulu; bila null, fallback
 * Bearer JWT mobile (getMobileUserWithScope — scope branchId/unitType/memberId
 * diambil fresh dari DB, bukan dari JWT yang bisa basi).
 *
 * Return shape kompatibel session NextAuth: { user: { id, email, name, role,
 * branchId, unitType, memberId } }. `role` string polos — route pemanggil
 * sudah melakukan includes()/=== sendiri. Tip dikembalikan `any` agar tidak
 * perlu cast di 10 situs pemanggil (session NextAuth memakai tipe tambahan
 * seperti permissions yang tidak dimiliki token mobile).
 */
export async function authWithMobile(request: Request): Promise<any> {
    const session = await auth();
    if (session?.user) return session;
    const mobile = await getMobileUserWithScope(request);
    if (!mobile) return null;
    return {
        user: {
            id: mobile.id,
            email: mobile.email,
            name: mobile.name,
            role: mobile.role,
            branchId: mobile.branchId,
            unitType: mobile.unitType,
            memberId: mobile.memberId,
        },
    };
}
