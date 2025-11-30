// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import UserModel from "@/models/User";
import { Types } from "mongoose";
import { verifyAppToken } from "@/lib/jwt";

const COOKIE_NAME = "token";

type UserSafe = {
  _id: string;
  name: string;
  email: string;
  warehouseId?: string;
};

type SuccessBody = { user: UserSafe };
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

    let userId = "";
    try {
      const payload = verifyAppToken(cookie.value);
      if (payload.role !== "WAREHOUSE" && payload.role !== "ADMIN") {
        // agar kuch logic hai ki warehouse + admin dono user panel use kar sakte ho
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }
      userId = payload.sub;
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const user = await UserModel.findById(userId).exec();
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        user: {
          _id: (user._id as Types.ObjectId).toString(),
          name: user.name,
          email: user.email,
          warehouseId: user.warehouses?.toString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Auth me error:", message);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
