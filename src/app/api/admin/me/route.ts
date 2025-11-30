import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt"; // Apna JWT verify function
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await User.findById(decoded.id).select("name email role");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
