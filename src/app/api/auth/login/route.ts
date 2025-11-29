// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { Document } from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import "@/models/Warehouse"; // Warehouse schema register ho jayega

interface LoginBody {
  email?: string;
  password?: string;
}

interface JwtPayload {
  sub: string;
  role?: string;
  iat?: number;
  exp?: number;
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
  access?: Record<string, unknown>;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "";

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

    // 👉 Sirf USER ko allow kar rahe hain, admin yaha se login nahi hoga
    const userDoc = (await User.findOne({
      email: { $regex: `^${emailInput}$`, $options: "i" },
      role: "user",
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

    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured: JWT secret missing" },
        { status: 500 }
      );
    }

    const payload: JwtPayload = {
      sub: String(userDoc._id),
      role: "user",
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    const userSafe = {
      id: String(userDoc._id),
      name: userDoc.name ?? "",
      email: userDoc.email ?? "",
      role: "user" as const,
      warehouses: (userDoc.warehouses ?? []).map((w: Warehouse) => ({
        _id: String(w._id),
        name: w.name,
      })),
      access: userDoc.access ?? {},
    };

    const isProd = process.env.NODE_ENV === "production";

    const cookieStr = cookie.serialize("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    const res = NextResponse.json(
      { success: true, user: userSafe },
      { status: 200 }
    );
    res.headers.set("Set-Cookie", cookieStr);
    return res;
  } catch (err) {
    console.error("Auth login error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Server error" },
      { status: 500 }
    );
  }
}
