import { NextRequest, NextResponse } from "next/server";
import { verifyTokenFromReq, requireAdminOrWarehouse } from "@/lib/token";
import { randomBytes } from "crypto";
import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import Category from "@/models/Category";
import { Types } from "mongoose";

/* ----- Types & Guards ----- */

type AuthPayload = {
  id: string;
  role: string;
};

function isAuthPayload(x: unknown): x is AuthPayload {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.role === "string";
}

type CategoryLean = {
  _id: Types.ObjectId | string;
  name: string;
};

type ProductLean = {
  _id: Types.ObjectId | string;
  name: string;
  sku?: string;
  categoryId?: CategoryLean | null;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string | null;
  taxRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
  // allow other fields but keep them unknown (not any)
  [key: string]: unknown;
};

type CreateProductBody = {
  name: string;
  categoryId: string;
  purchasePrice: string | number;
  sellingPrice: string | number;
  description?: string | null;
  taxRate?: string | number;
};

function isCreateProductBody(x: unknown): x is CreateProductBody {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.categoryId === "string" &&
    (typeof obj.purchasePrice === "string" || typeof obj.purchasePrice === "number") &&
    (typeof obj.sellingPrice === "string" || typeof obj.sellingPrice === "number") &&
    (typeof obj.taxRate === "string" || typeof obj.taxRate === "number")
  );
}

/* ----- GET all products ----- */

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const products = (await Product.find({})
      .populate("categoryId", "name")
      .sort({ createdAt: -1 })
      .lean()) as unknown as ProductLean[];

    const formatted = products.map((p) => ({
      ...p,
      id: typeof p._id === "string" ? p._id : p._id.toString(),
      taxRate: typeof p.taxRate === "number" ? p.taxRate : 0, 
      category: p.categoryId
        ? { id: typeof p.categoryId._id === "string" ? p.categoryId._id : p.categoryId._id.toString(), name: p.categoryId.name }
        : null,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    // still safe to log error message
    console.error("GET /products error:", (err as Error)?.message ?? err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

/* ----- POST create product ----- */

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // const maybePayload = verifyTokenFromReq(req);
    // if (!isAuthPayload(maybePayload) || !requireAdminOrWarehouse(maybePayload)) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }
    // const payload = maybePayload; // now typed as AuthPayload

    const body = (await req.json()) as unknown;
    if (!isCreateProductBody(body)) {
      return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
    }

    const { name, categoryId, purchasePrice, sellingPrice, description, taxRate } = body;

    const category = await Category.findById(categoryId);
    if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

    const sku = "SKU-" + randomBytes(4).toString("hex").toUpperCase();

    const data = {
      name,
      sku,
      categoryId,
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      description: description ?? null,
      taxRate: Number(taxRate),
    } as {
      name: string;
      sku: string;
      categoryId: string;
      purchasePrice: number;
      sellingPrice: number;
      description: string | null;
      createdByAdminId?: string;
      createdByWarehouseId?: string;
      taxRate: number;
    };

    // if (payload.role === "ADMIN") data.createdByAdminId = payload.id;
    // if (payload.role === "WAREHOUSE") data.createdByWarehouseId = payload.id;

    const productDoc = await Product.create(data);
    const populated = await productDoc.populate("categoryId", "name");

    const populatedObj = populated.toObject() as ProductLean & { categoryId?: CategoryLean | null };

    return NextResponse.json(
      {
        ...populatedObj,
        id: typeof populatedObj._id === "string" ? populatedObj._id : populatedObj._id.toString(),
        category: populatedObj.categoryId
          ? {
            id: typeof populatedObj.categoryId._id === "string" ? populatedObj.categoryId._id : populatedObj.categoryId._id.toString(),
            name: populatedObj.categoryId.name,
          }
          : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /products error:", (err as Error)?.message ?? err);
    return NextResponse.json({ error: (err as Error)?.message || "Failed to create product" }, { status: 500 });
  }
}
