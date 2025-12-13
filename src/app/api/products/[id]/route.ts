import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";

type RouteCtx<T extends Record<string, string>> =
  | { params: T }
  | { params: Promise<T> };

type ObjIdLike = string | { toString?: () => string };

interface Category {
  _id: ObjIdLike;
  name: string;
}

interface ProductDoc {
  _id: ObjIdLike;
  name: string;
  sku?: string;
  categoryId?: Category | string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string | null;
  createdByAdminId?: string | null;
  createdByWarehouseId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
  hsnCode?: string | null;
  taxPercent?: number | string | null;
  perBoxItem?: number | string | null;
}

function objIdToString(id: ObjIdLike): string {
  if (id == null) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object" && typeof id.toString === "function") {
    return id.toString();
  }
  return String(id);
}

export async function GET(req: NextRequest, context: RouteCtx<{ id: string }>) {
  const params = await context.params;
  const { id } = params;

  try {
    await dbConnect();

    const product = (await Product.findById(id)
      .populate("categoryId", "name")
      .lean()) as ProductDoc | null;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formatted = {
      ...product,
      id: objIdToString(product._id),
      category:
        product.categoryId && typeof product.categoryId === "object"
          ? {
            id: objIdToString((product.categoryId as Category)._id),
            name: (product.categoryId as Category).name,
          }
          : null,
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteCtx<{ id: string }>) {
  const params = await context.params;
  const { id } = params;

  try {
    await dbConnect();

    const body = await req.json();
    console.log("PUT /api/products/:id body:", JSON.stringify(body));

    const {
      name,
      categoryId,
      purchasePrice,
      sellingPrice,
      description,
      taxPercent: rawTaxPercent,
      perBoxItem: rawPerBoxItem,
      hsnCode,
    } = body as Record<string, unknown>;

    const setObj: Record<string, unknown> = {};

    if (name !== undefined) setObj.name = String(name);
    if (categoryId !== undefined) setObj.categoryId = categoryId;
    if (purchasePrice !== undefined) {
      const pp = Number(purchasePrice);
      if (Number.isNaN(pp)) {
        return NextResponse.json(
          { error: "Invalid purchasePrice" },
          { status: 400 }
        );
      }
      setObj.purchasePrice = pp;
    }
    if (sellingPrice !== undefined) {
      const sp = Number(sellingPrice);
      if (Number.isNaN(sp)) {
        return NextResponse.json(
          { error: "Invalid sellingPrice" },
          { status: 400 }
        );
      }
      setObj.sellingPrice = sp;
    }
    if (description !== undefined) {
      setObj.description = description === null ? null : String(description);
    }
    if (hsnCode !== undefined) {
      setObj.hsnCode = hsnCode === null ? null : String(hsnCode);
    }

    if (rawTaxPercent !== undefined) {
      const tax = Number(rawTaxPercent);
      if (Number.isNaN(tax) || tax < 0 || tax > 100) {
        return NextResponse.json(
          { error: "Invalid taxPercent (must be 0 - 100)" },
          { status: 400 }
        );
      }
      setObj.taxPercent = tax;
    }

    if (rawPerBoxItem !== undefined) {
      const perBox = Number(rawPerBoxItem);
      if (Number.isNaN(perBox) || perBox <= 0) {
        return NextResponse.json(
          { error: "Invalid perBoxItem (must be > 0)" },
          { status: 400 }
        );
      }
      setObj.perBoxItem = perBox;
    }

    console.log("PUT /api/products/:id setObj:", JSON.stringify(setObj));

    if (Object.keys(setObj).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = (await Product.findByIdAndUpdate(
      id,
      { $set: setObj },
      { new: true, runValidators: true }
    )
      .populate("categoryId", "name")
      .lean()) as ProductDoc | null;

    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formatted = {
      ...updated,
      id: objIdToString(updated._id),
      category:
        updated.categoryId && typeof updated.categoryId === "object"
          ? {
            id: objIdToString((updated.categoryId as Category)._id),
            name: (updated.categoryId as Category).name,
          }
          : null,
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch (err: unknown) {
    console.error("PUT /api/products/:id error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteCtx<{ id: string }>
) {
  const params = await context.params;
  const { id } = params;

  try {
    await dbConnect();
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Product deleted" }, { status: 200 });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete product" },
      { status: 500 }
    );
  }
}
