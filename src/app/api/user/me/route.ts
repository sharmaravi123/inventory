// src/app/api/user/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

type AccessLevel = "all" | "limited";

interface WarehouseLean {
  _id?: unknown;
  name?: unknown;
}

interface UserLean {
  _id: unknown;
  name: string;
  email: string;
  role: "admin" | "user";
  warehouses?: Array<WarehouseLean | string>;
  access?: { level: AccessLevel; permissions: string[] };
}

interface TokenPayload {
  sub?: string;
  id?: string;
  _id?: string;
}

function toStringId(id: unknown): string {
  // direct primitives
  if (typeof id === "string") return id;
  if (typeof id === "number") return String(id);

  if (!id || typeof id !== "object") return "";

  // Mongoose ObjectId ya koi aur object jisme toString() ho
  if (
    "toString" in id &&
    typeof (id as { toString: () => string }).toString === "function"
  ) {
    return (id as { toString: () => string }).toString();
  }

  // Agar object ke andar _id hai
  if ("_id" in (id as Record<string, unknown>)) {
    const inner = (id as { _id: unknown })._id;

    if (typeof inner === "string") return inner;
    if (typeof inner === "number") return String(inner);

    if (
      inner &&
      typeof inner === "object" &&
      "toString" in inner &&
      typeof (inner as { toString: () => string }).toString === "function"
    ) {
      return (inner as { toString: () => string }).toString();
    }
  }

  return "";
}

export async function GET() {
  try {
    await dbConnect();

    // cookies() sync hai, yaha await nahi hoga
    const cookieStore = cookies();
    const tokenCookie = (await cookieStore).get("token");

    if (!tokenCookie) {
      return NextResponse.json(
        { error: "Not authenticated (no token cookie)" },
        { status: 401 }
      );
    }

    const token = tokenCookie.value;

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "JWT secret not configured on server" },
        { status: 500 }
      );
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, secret) as TokenPayload;
    } catch (_error) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = payload.sub ?? payload.id ?? payload._id;
    if (!userId) {
      return NextResponse.json(
        { error: "Token payload missing user id" },
        { status: 401 }
      );
    }

    const userDoc = await User.findById(String(userId))
      .populate("warehouses", "name")
      .lean<UserLean>()
      .exec();

    if (!userDoc) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const rawWarehouses = userDoc.warehouses ?? [];

    const warehouses = (rawWarehouses as Array<WarehouseLean | string>).map(
      (w): { _id: string; name?: string } => {
        if (typeof w === "string") {
          return { _id: w };
        }

        const id = toStringId(w._id);
        const name =
          typeof w.name === "string" ? (w.name as string) : undefined;

        return { _id: id, name };
      }
    );

    const access =
      userDoc.access ??
      ({
        level: "limited",
        permissions: [],
      } as { level: AccessLevel; permissions: string[] });

    const user = {
      _id: toStringId(userDoc._id),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      warehouses,
      access,
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error("GET /api/user/me error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: (error as Error)?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
