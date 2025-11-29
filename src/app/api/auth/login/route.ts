// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Document } from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import "@/models/Warehouse";
import { signToken, AuthTokenPayload } from "@/lib/jwt";

interface LoginBody {
  email?: string;
  password?: string;
}

interface Warehouse {
  _id: unknown;
  name: string;
}

interface UserDoc extends Document {
  _id: unknown;
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  warehouses?: Warehouse[];
  access?: { permissions?: string[] } | null;
}

function normalizeEmail(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginBody;
    const emailInput = normalizeEmail(body.email);
    const password = body.password ?? "";

    if (!emailInput || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const userDoc = (await User.findOne({
      email: { $regex: `^${emailInput}$`, $options: "i" },
      role: "user", // DB me role
    })
      .select("+password")
      .populate("warehouses", "name")) as UserDoc | null;

    if (!userDoc) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const hashedPassword = userDoc.password ?? "";
    if (!hashedPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 👉 JWT payload – warehouse layout + ensureHasAccess ke hisaab se
    const payload: AuthTokenPayload = {
      id: String(userDoc._id),
      role: "warehouse",
    };

    const token = signToken(payload);

    const userSafe = {
      id: String(userDoc._id),
      name: userDoc.name ?? "",
      email: userDoc.email ?? "",
      role: "user" as const,
      warehouses: (userDoc.warehouses ?? []).map((w: Warehouse) => ({
        _id: String(w._id),
        name: w.name,
      })),
      access: userDoc.access ?? { permissions: [] },
    };

    const isProd = process.env.NODE_ENV === "production";

    const res = NextResponse.json(
      { success: true, user: userSafe, token },
      { status: 200 }
    );

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    console.error("Auth login error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
