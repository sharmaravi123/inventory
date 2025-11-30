// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User, { IUser } from "@/models/User";
import { Types } from "mongoose";
import { signAppToken } from "@/lib/jwt";

const COOKIE_NAME = "token";

type LoginBody = {
  email: string;
  password: string;
};

type UserSafe = {
  _id: string;
  name: string;
  email: string;
  warehouses?: string[];
  access?: {
    level?: string;
    permissions?: string[];
  } | null;
};

type SuccessBody = {
  user: UserSafe;
  token: string;
};

type ErrorBody = { error: string };

export async function POST(
  req: NextRequest
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  try {
    await dbConnect();

    const body = (await req.json()) as LoginBody;

    const emailInput = body.email?.trim();
    const password = body.password;

    if (!emailInput || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // login form se email aa raha hai
    const email = emailInput.toLowerCase();

    // 🔍 User dhoondo (yaha isActive pe filter NAHI laga rahe, baad me check karenge)
    const userDoc = (await User.findOne({
      email,
    }).exec()) as (IUser & { _id: Types.ObjectId }) | null;

    if (!userDoc) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Agar tumhare User model me isActive field hai:
    if (Object.prototype.hasOwnProperty.call(userDoc, "isActive")) {
      const activeValue = (userDoc as unknown as { isActive?: boolean })
        .isActive;
      if (activeValue === false) {
        return NextResponse.json(
          { error: "Account is inactive" },
          { status: 403 }
        );
      }
    }

    // Password hash field ka naam match karo
    // Agar tumhare model me "passwordHash" hai:
    const passwordHashValue = (userDoc as unknown as {
      passwordHash?: string;
      password?: string;
    }).passwordHash;

    const passwordPlainValue = (userDoc as unknown as {
      passwordHash?: string;
      password?: string;
    }).password;

    const storedHash = passwordHashValue || passwordPlainValue;

    if (!storedHash) {
      console.error(
        "User document has no password field for email:",
        email
      );
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, storedHash);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 🔐 JWT issue karo – yaha warehouse/user panel ke liye role "WAREHOUSE"
    const token = signAppToken({
      sub: userDoc._id.toString(),
      role: "WAREHOUSE",
      warehouseId: userDoc.warehouses
        ? (userDoc.warehouses as unknown as Types.ObjectId).toString()
        : undefined,
    });

    const safeUser: UserSafe = {
      _id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      warehouses: Array.isArray(userDoc.warehouses)
        ? userDoc.warehouses.map((w: unknown) => {
            const wObj = w as { _id?: Types.ObjectId };
            return wObj._id ? wObj._id.toString() : "";
          })
        : undefined,
      access: userDoc.access
        ? {
            level: userDoc.access.level,
            permissions: userDoc.access.permissions,
          }
        : null,
    };

    const res = NextResponse.json(
      {
        user: safeUser,
        token,
      },
      { status: 200 }
    );

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Auth login error:", message);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}
