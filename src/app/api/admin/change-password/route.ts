// src/app/api/admin/change-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { verifyAppToken } from "@/lib/jwt";

type Body = {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

function readBearerToken(req: NextRequest): string | null {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const oldPassword = body.oldPassword?.trim() ?? "";
    const newPassword = body.newPassword?.trim() ?? "";
    const confirmPassword = body.confirmPassword?.trim() ?? "";

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirm password do not match." },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from old password." },
        { status: 400 }
      );
    }

    const cookieToken =
      req.cookies.get("adminToken")?.value ??
      req.cookies.get("token")?.value ??
      null;
    const headerToken = readBearerToken(req);
    const token = headerToken ?? cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Missing admin token" },
        { status: 401 }
      );
    }

    let payload: ReturnType<typeof verifyAppToken>;
    try {
      payload = verifyAppToken(token);
    } catch {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    if (payload.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied — admin only" },
        { status: 403 }
      );
    }

    await dbConnect();
    const admin = await User.findById(payload.sub).select("+password");

    if (!admin || admin.role !== "admin") {
      return NextResponse.json(
        { error: "Admin not found" },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Old password is incorrect." },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    admin.password = hashed;
    await admin.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const e = err as Error;
    console.error("Admin change password error:", e.message);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
