import dns from "node:dns";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

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

const id = "6975fb9fe735ab7f48b96581";

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Missing MONGODB_URI");
  if (uri.startsWith("mongodb+srv://")) dns.setServers(["8.8.8.8", "1.1.1.1"]);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const oid = new mongoose.Types.ObjectId(id);
  const stocks = await mongoose.connection.collection("stocks").find({
    $or: [{ productId: id }, { productId: oid }],
  }).toArray();
  console.log("STOCKS", JSON.stringify(stocks, null, 2));

  const product = await mongoose.connection.collection("products").findOne({ _id: oid });
  console.log("PRODUCT", product ? product.name : null);

  const bill = await mongoose.connection.collection("bills").findOne(
    { "items.product": oid },
    { projection: { "items.$": 1, invoiceNumber: 1 } }
  );
  console.log("BILL ITEM", JSON.stringify(bill, null, 2));

  const purchase = await mongoose.connection.collection("purchases").findOne(
    { "items.productId": oid },
    { projection: { "items.$": 1, invoiceNumber: 1 } }
  );
  console.log("PURCHASE ITEM", JSON.stringify(purchase, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
