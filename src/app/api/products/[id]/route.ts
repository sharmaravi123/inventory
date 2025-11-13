import { NextRequest, NextResponse } from "next/server";
import { verifyTokenFromReq, requireAdminOrWarehouse } from "@/lib/token";
import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";

/* -----------------------
   Types
------------------------*/

type RouteCtx<T extends Record<string, string>> =
  | { params: T }
  | { params: Promise<T> };

interface Category {
  _id: string;
  name: string;
}

interface ProductDoc {
  _id: string;
  name: string;
  categoryId?: Category | string;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
  taxRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

/* -----------------------
   GET PRODUCT BY ID
------------------------*/
export async function GET(
  req: NextRequest,
  context: RouteCtx<{ id: string }>
) {
  const params = await context.params;
  const { id } = params;

  try {
    await dbConnect();

    const product = await Product.findById(id)
      .populate("categoryId", "name")
      .lean<ProductDoc>();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const formatted = {
      ...product,
      id: product._id.toString(),
      taxRate: typeof product.taxRate === "number" ? product.taxRate : 0,
      category:
        typeof product.categoryId === "object" && product.categoryId
          ? {
              id: (product.categoryId as Category)._id,
              name: (product.categoryId as Category).name,
            }
          : null,
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

/* -----------------------
   UPDATE PRODUCT
------------------------*/
export async function PUT(
  req: NextRequest,
  context: RouteCtx<{ id: string }>
) {
  const params = await context.params;
  const { id } = params;

  // Uncomment if you want authentication:
  //
  // const payload = verifyTokenFromReq(req);
  // if (!payload || !requireAdminOrWarehouse(payload)) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    await dbConnect();

    const {
      name,
      categoryId,
      purchasePrice,
      sellingPrice,
      description,
      taxRate,
    } = await req.json();

    const updateData: Partial<ProductDoc> = {};

    if (name !== undefined && name !== "") updateData.name = name;
    if (categoryId !== undefined && categoryId !== "")
      updateData.categoryId = categoryId;
    if (purchasePrice !== undefined && purchasePrice !== "")
      updateData.purchasePrice = Number(purchasePrice);
    if (sellingPrice !== undefined && sellingPrice !== "")
      updateData.sellingPrice = Number(sellingPrice);
    if (description !== undefined) updateData.description = description;

    // ⭐ TAX FIX (correct update)
    if (taxRate !== undefined && taxRate !== "") {
      updateData.taxRate = Number(taxRate);
    }

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("categoryId", "name")
      .lean<ProductDoc>();

    if (!updated) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // ⭐ FIX: ensure taxRate never drops
    let finalTaxRate = updated.taxRate ?? 0;

    if (typeof updated.taxRate !== "number") {
      const fresh = await Product.findById(id).lean<ProductDoc>();
      finalTaxRate = fresh?.taxRate ?? 0;
    }

    const formatted = {
      ...updated,
      id: updated._id.toString(),
      taxRate: finalTaxRate,
      category:
        typeof updated.categoryId === "object" && updated.categoryId
          ? {
              id: (updated.categoryId as Category)._id,
              name: (updated.categoryId as Category).name,
            }
          : null,
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update product",
      },
      { status: 500 }
    );
  }
}

/* -----------------------
   DELETE PRODUCT
------------------------*/
export async function DELETE(
  req: NextRequest,
  context: RouteCtx<{ id: string }>
) {
  const params = await context.params;
  const { id } = params;

  const payload = verifyTokenFromReq(req);
  if (!payload || !requireAdminOrWarehouse(payload)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();

    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Product deleted" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to delete product",
      },
      { status: 500 }
    );
  }
}
