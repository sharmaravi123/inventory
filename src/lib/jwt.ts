// src/lib/jwt.ts
import jwt, { JwtPayload } from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "devsecret";

export interface AuthTokenPayload extends JwtPayload {
  id: string;
  role: "admin" | "user" | "warehouse" | "DRIVER";
  sub?: string; // backward compatibility if any old token used `sub`
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, SECRET) as AuthTokenPayload;
  return decoded;
}
