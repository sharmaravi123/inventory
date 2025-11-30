// lib/authorize.ts
import { NextRequest } from "next/server";
import { verifyAppToken, AppJwtPayload } from "@/lib/jwt";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User, { IUser } from "@/models/User";

export async function verifyAndGetUser(req: NextRequest): Promise<IUser> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }

  const token = authHeader.split(" ")[1];

  let decoded: AppJwtPayload;
  try {
    decoded = verifyAppToken(token);
  } catch {
    throw new Error("Token verification failed");
  }

  if (
    !decoded.sub ||
    typeof decoded.sub !== "string" ||
    !mongoose.Types.ObjectId.isValid(decoded.sub)
  ) {
    throw new Error("Invalid user ID in token");
  }

  await dbConnect();

  const user = await User.findById(decoded.sub).exec();
  if (!user) throw new Error("User not found");

  return user;
}

export function ensureAdmin(user: IUser): void {
  if (user.role !== "admin") {
    throw new Error("Access denied — admin only");
  }
}
