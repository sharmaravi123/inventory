// ./src/app/api/user/list/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await dbConnect();

    const users = await User.find({ role: "user" })
      .select("-password")
      .populate("warehouses", "name")
      .lean();

    return NextResponse.json({ users }, { status: 200 });
  } catch (error: unknown) {
    console.error("User list error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Server error" },
      { status: 500 }
    );
  }
}
