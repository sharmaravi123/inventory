// src/lib/access.ts
import jwt from "jsonwebtoken";
import dbConnect from "./mongodb";
import User from "@/models/User";

interface JwtAccess {
  permissions?: string[];
  level?: string;
}

interface JwtPayload {
  sub?: string;
  role?: string;
  access?: JwtAccess;
  warehouses?: unknown[];
}

export interface AccessUser {
  _id?: string;
  role?: string;
  access?: JwtAccess;
  warehouses?: unknown[];
}

export interface AccessResult {
  user: AccessUser | null;
  authorized: boolean;
}

/**
 * Token -> user (DB se)
 */
export async function getUserFromTokenOrDb(token?: string): Promise<AccessUser | null> {
  if (!token) return null;

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET ?? "") as JwtPayload;
  } catch {
    return null;
  }

  if (!payload.sub) return null;

  // Agar token me hi access data hai to minimal object return
  if (payload.access?.permissions) {
    return {
      _id: payload.sub,
      role: payload.role,
      access: payload.access,
      warehouses: payload.warehouses ?? [],
    };
  }

  try {
    await dbConnect();
    const userDoc = await User.findById(payload.sub).select("-password").lean();
    if (!userDoc) return null;

    return {
      _id: userDoc._id?.toString(),
      role: userDoc.role,
      access: userDoc.access,
      warehouses: userDoc.warehouses ?? [],
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("getUserFromTokenOrDb error:", e);
    return null;
  }
}

/**
 * ensureHasAccess
 * - Koi redirect nahi karega
 * - Sirf { user, authorized } return karega
 */
export async function ensureHasAccess(
  token: string | null | undefined,
  opts: { perm?: string; path?: string }
): Promise<AccessResult> {
  const user = await getUserFromTokenOrDb(token ?? undefined);
  if (!user) {
    return { user: null, authorized: false };
  }

  const { perm, path } = opts;

  // Map path -> permission
  const permMap: Record<string, string> = {
    "/warehouse/inventory": "inventory",
    "/warehouse/product": "product",
    "/warehouse/orders": "orders",
    "/warehouse/reports": "reports",
    "/warehouse/billing": "billing",
  };

  const allowedPermissions: string[] = user.access?.permissions ?? [];

  // Admin ya level === "all" -> full access
  if (user.role === "admin" || user.access?.level === "all") {
    return { user, authorized: true };
  }

  const requiredPerm = perm ?? (path ? permMap[path] : undefined);

  // Agar koi specific permission nahi mangi -> allow
  if (!requiredPerm) {
    return { user, authorized: true };
  }

  const authorized = allowedPermissions.includes(requiredPerm);
  return { user, authorized };
}
