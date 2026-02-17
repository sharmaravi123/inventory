// lib/mongodb.ts
import dns from "node:dns";
import mongoose from "mongoose";

const MONGODB_URI: string = process.env.MONGODB_URI || ("" as string);

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI in your environment");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.mongooseCache ?? { conn: null, promise: null };

let dnsConfigured = false;

function configureMongoDns(): void {
  if (dnsConfigured) return;
  if (!MONGODB_URI.startsWith("mongodb+srv://")) return;
  if (process.env.MONGODB_DNS_FALLBACK === "false") return;

  const configured = process.env.MONGODB_DNS_SERVERS;
  const servers = (configured ? configured.split(",") : ["8.8.8.8", "1.1.1.1"])
    .map((s) => s.trim())
    .filter(Boolean);

  if (servers.length === 0) return;

  try {
    dns.setServers(servers);
    dnsConfigured = true;
  } catch (error) {
    const e = error as Error;
    console.error("MongoDB DNS setup failed:", e.message);
  }
}

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    configureMongoDns();

    const opts: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    global.mongooseCache = cached;
    return cached.conn;
  } catch (err) {
    const e = err as Error & { code?: string | number };
    console.error("MongoDB connect failed:", e.code ?? "NO_CODE", e.message);
    throw err;
  }
}
