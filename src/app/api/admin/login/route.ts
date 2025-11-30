// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { AppJwtPayload, signAppToken,  } from "@/lib/jwt";

type Body = { email?: string; password?: string };

interface AdminDoc {
  _id: { toString(): string };
  name?: string | null;
  email?: string | null;
  password?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const rawEmail = body.email?.trim();
    const password = body.password ?? "";

    if (!rawEmail || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();

    await dbConnect();

    const adminFound = await User.findOne({ email, role: "admin" }).select(
      "+password"
    );

    if (!adminFound) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const admin = adminFound as unknown as AdminDoc;

    if (!admin.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const adminId = admin._id.toString();

    const payload: AppJwtPayload = {
      sub: adminId,
      role: "ADMIN",
    };

    const token = signAppToken(payload);

    const res = NextResponse.json(
      {
        success: true,
        admin: {
          id: adminId,
          name: admin.name ?? null,
          email: admin.email ?? null,
          role: "admin" as const,
          token,
        },
      },
      { status: 200 }
    );

    const isProd = process.env.NODE_ENV === "production";

    res.cookies.set("token", token, {
  httpOnly: true,
  sameSite: "strict", // "lax" se "strict" karo production ke liye
  secure: isProd,     // production mein true
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
  domain: isProd ? "https://inventory-five-iota.vercel.app/" : undefined, // Vercel custom domain add karo
});

    return res;
  } catch (err) {
    const e = err as Error;
    console.error("Admin login error:", e.message);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
