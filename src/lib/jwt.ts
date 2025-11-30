// src/lib/jwt.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_inventory_secret_key";

export type AppJwtRole = "ADMIN" | "WAREHOUSE" | "DRIVER";

export type AppJwtPayload = {
  sub: string; // userId / adminId / driverId
  role: AppJwtRole;
  warehouseId?: string; // warehouse user ke liye agar hai toh
};

export function signAppToken(payload: AppJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAppToken(token: string): AppJwtPayload {
  return jwt.verify(token, JWT_SECRET) as AppJwtPayload;
}
