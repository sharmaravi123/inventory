// src/app/api/admin/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import AdminModel from "@/models/admin";
import { Types } from "mongoose";
import { verifyAppToken } from "@/lib/jwt";

const COOKIE_NAME = "token";

type AdminSafe = {
  _id: string;
  name: string;
  email: string;
};

type SuccessBody = { admin: AdminSafe };
type ErrorBody = { error: string };

export async function GET(
  req: NextRequest
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  try {
    await dbConnect();

    const cookie = req.cookies.get(COOKIE_NAME);
    if (!cookie || !cookie.value) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let adminId = "";

    try {
      const payload = verifyAppToken(cookie.value);
      if (payload.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }
      adminId = payload.sub;
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const admin = await AdminModel.findById(adminId).exec();
    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: "Admin not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        admin: {
          _id: (admin._id as Types.ObjectId).toString(),
          name: admin.name,
          email: admin.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Admin me error:", message);
    return NextResponse.json(
      { error: "Failed to fetch admin" },
      { status: 500 }
    );
  }
}
