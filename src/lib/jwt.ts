import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.AUTH_SECRET || "development-secret-key-fallback-primkoppol";
const JWT_EXPIRES_IN = "30d";

export interface MobileJWTPayload {
    id: string;
    email: string;
    name: string;
    role: string;
    nrp?: string | null;
    unitId?: number | null;
    branchId?: number | null;
    isOperator?: boolean;
}

export function signMobileToken(payload: MobileJWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyMobileToken(token: string): MobileJWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as MobileJWTPayload;
        return decoded;
    } catch (error) {
        return null;
    }
}
