// src/lib/access.ts
import dbConnect from "@/lib/mongodb";
import User, { IUser } from "@/models/User";
import { verifyToken } from "@/lib/jwt";

export type AccessPath =
  | "/warehouse/billing"
  | "/warehouse/inventory"
  | "/warehouse/orders"
  | "/warehouse/reports"
  | "/admin/products"
  | string; // fallback for any other paths

export interface EnsureAccessOptions {
  path: AccessPath;
}

export interface EnsuredUser {
  // lean user structure
  _id: unknown;
  name?: string;
  email?: string;
  role?: string;
  warehouses?: unknown[];
  access?: {
    level?: string;
    permissions?: string[];
  } | null;
}

/**
 * Token se JWT decode karo, user ko DB se load karo (password ke bina),
 * warehouses populate karo.
 */
export async function getUserFromTokenOrDb(
  token?: string | null
): Promise<EnsuredUser | null> {
  if (!token) return null;

  try {
    const payload = verifyToken(token);

    // id prefer karo, agar kabhi sub set ho to fallback me use kar sakte
    const userId = payload.id || payload.sub;
    if (!userId) {
      return null;
    }

    await dbConnect();

    const user = await User.findById(userId)
      .select("-password")
      .populate("warehouses", "name")
      .lean<IUser>()
      .exec();

    if (!user) return null;

    return user as unknown as EnsuredUser;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getUserFromTokenOrDb error:", err);
    return null;
  }
}

/**
 * path + user.access.permissions ke basis par authorized check karega.
 * Admin ko full access.
 */
export async function ensureHasAccess(
  token: string | null,
  options: EnsureAccessOptions
): Promise<{ user: EnsuredUser | null; authorized: boolean }> {
  const user = await getUserFromTokenOrDb(token);
  if (!user) {
    return { user: null, authorized: false };
  }

  const role = user.role ?? "";

  // Admin -> sab allowed
  if (role === "admin") {
    return { user, authorized: true };
  }

  const perms = user.access?.permissions ?? [];

  // Path -> permission mapping
  const pathToPermission: Record<string, string> = {
    "/warehouse/billing": "billing",
    "/warehouse/inventory": "inventory",
    "/warehouse/orders": "orders",
    "/warehouse/reports": "reports",
    // agar products ke liye bhi permission hai to yaha map kar sakte
    "/admin/products": "inventory",
  };

  const requiredPerm = pathToPermission[options.path];

  // Agar koi mapping nahi mili, to by default allow kar do user ko.
  // (agar strict chahiye, to yaha false kar sakte)
  if (!requiredPerm) {
    return { user, authorized: true };
  }

  const authorized = perms.includes(requiredPerm);

  return { user, authorized };
}
