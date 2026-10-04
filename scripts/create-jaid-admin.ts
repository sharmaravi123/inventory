/**
 * Create/update Jaid admin on the DB from .env.local MONGODB_URI
 * Usage: npx tsx scripts/create-jaid-admin.ts
 */
import dns from "node:dns";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function configureMongoDns(uri: string) {
  if (!uri.startsWith("mongodb+srv://")) return;
  if (process.env.MONGODB_DNS_FALLBACK === "false") return;
  const configured = process.env.MONGODB_DNS_SERVERS;
  const servers = (configured ? configured.split(",") : ["8.8.8.8", "1.1.1.1"])
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length === 0) return;
  try {
    dns.setServers(servers);
  } catch (e) {
    console.error("DNS setup failed:", (e as Error).message);
  }
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ["admin", "user"], default: "user" },
    warehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" }],
    access: {
      level: { type: String, enum: ["all", "limited"], default: "limited" },
      permissions: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("Missing MONGODB_URI in .env.local");
    process.exit(1);
  }

  configureMongoDns(uri);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
  console.log("Connected to MongoDB");

  const User = mongoose.models.User || mongoose.model("User", userSchema);
  const email = "admin@jaid.com";
  const password = "123456";
  const hashed = await bcrypt.hash(password, 10);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.password = hashed;
    existing.role = "admin";
    existing.name = existing.name || "Jaid Admin";
    existing.access = { level: "all", permissions: [] };
    await existing.save();
    console.log("Updated existing admin:", email, "id=", String(existing._id));
  } else {
    const admin = await User.create({
      name: "Jaid Admin",
      email,
      password: hashed,
      role: "admin",
      access: { level: "all", permissions: [] },
    });
    console.log("Created admin:", email, "id=", String(admin._id));
  }

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
