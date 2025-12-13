import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import Product, { IProduct } from "@/models/Product";
import { getUserFromTokenOrDb } from "@/lib/access";

function normalize(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

interface UserWarehouse {
  _id?: unknown;
}

interface UserType {
  role?: string;
  access?: { level?: string; permissions?: string[] };
  warehouses?: UserWarehouse[];
}

async function resolveParams(input: { params: unknown } | undefined) {
  if (!input) return null;

  const raw = input.params;
  const finalValue =
    raw && typeof (raw as Promise<unknown>).then === "function"
      ? await (raw as Promise<unknown>)
      : raw;

  if (!finalValue || typeof finalValue !== "object") return null;

  const id = (finalValue as { id?: unknown }).id;

  return typeof id === "string" ? id : null;
}

function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    let v = authHeader.trim();
    if (v.toLowerCase().startsWith("bearer ")) {
      v = v.slice(7).trim();
    }
    if (v) return v;
  }
  const cookieToken = req.cookies.get("token")?.value ?? null;
  return cookieToken;
}

type StockUpdatePayload = {
  boxes?: unknown;
  looseItems?: unknown;
  lowStockBoxes?: unknown;
  lowStockItems?: unknown;
};

export async function PUT(req: NextRequest, ctx: { params: unknown }) {
  try {
    await dbConnect();

    const token = getTokenFromRequest(req);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let user: UserType | null = null;
    try {
      user = (await getUserFromTokenOrDb(token)) as UserType | null;
    } catch {
      user = null;
    }

    const id = await resolveParams(ctx);
    if (!id) {
      return NextResponse.json(
        { error: "Missing id param" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as StockUpdatePayload;

    const existing = await Stock.findById(id).exec();
    if (!existing) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404 }
      );
    }

    if (user && user.access?.level !== "all" && user.role !== "admin") {
      const warehouses = user.warehouses ?? [];
      const allowedIds = warehouses
        .map((w): string | null =>
          w._id !== undefined ? String(w._id) : null
        )
        .filter((x): x is string => x !== null);

      const stockWarehouseId = String(
        (existing as { warehouseId?: unknown }).warehouseId ??
          (existing as { warehouse?: unknown }).warehouse ??
          ""
      );

      if (stockWarehouseId && !allowedIds.includes(stockWarehouseId)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            detail: "Not allowed to modify this stock",
          },
          { status: 403 }
        );
      }
    }

    const productIdValue = (existing as { productId?: unknown }).productId;
    const productId =
      typeof productIdValue === "string"
        ? productIdValue
        : String(productIdValue ?? "");

    let perBox = 1;
    if (productId) {
      const product = (await Product.findById(productId)
        .lean()
        .exec()) as IProduct | null;
      const perBoxItemFromProduct =
        product &&
        typeof (product as { perBoxItem?: unknown }).perBoxItem === "number"
          ? (product as { perBoxItem: number }).perBoxItem
          : 1;
      perBox = perBoxItemFromProduct > 0 ? perBoxItemFromProduct : 1;
    }

    const boxes = normalize(
      body.boxes ?? existing.boxes,
      existing.boxes
    );

    let looseItems = Math.max(
      0,
      normalize(
        body.looseItems ?? existing.looseItems,
        existing.looseItems
      )
    );

    const lowStockItems =
      typeof body.lowStockItems === "number"
        ? normalize(body.lowStockItems, 0)
        : existing.lowStockItems;

    const lowStockBoxes =
      typeof body.lowStockBoxes === "number"
        ? normalize(body.lowStockBoxes, 0)
        : existing.lowStockBoxes;

    if (perBox > 0 && looseItems >= perBox) {
      const extra = Math.floor(looseItems / perBox);
      // boxes += extra; // agar auto box increase chahiye to server side me yahan uncomment kar sakte ho
      looseItems = looseItems % perBox;
    }

    const totalItems = boxes * perBox + looseItems;

    existing.boxes = boxes;
    existing.looseItems = looseItems;
    existing.totalItems = totalItems;
    existing.lowStockItems = lowStockItems ?? null;
    existing.lowStockBoxes = lowStockBoxes ?? null;

    const saved = await existing.save();
    const out = saved.toObject();

    out._id = String(out._id);
    out.productId = String(out.productId);
    out.warehouseId = String(out.warehouseId);

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("PUT ERROR:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update stock",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: unknown }) {
  try {
    await dbConnect();

    const token = getTokenFromRequest(req);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let user: UserType | null = null;
    try {
      user = (await getUserFromTokenOrDb(token)) as UserType | null;
    } catch {
      user = null;
    }

    const id = await resolveParams(ctx);
    if (!id) {
      return NextResponse.json(
        { error: "Missing id param" },
        { status: 400 }
      );
    }

    const existing = await Stock.findById(id).exec();
    if (!existing) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404 }
      );
    }

    if (user && user.access?.level !== "all" && user.role !== "admin") {
      const warehouses = user.warehouses ?? [];
      const allowedIds = warehouses
        .map((w): string | null =>
          w._id !== undefined ? String(w._id) : null
        )
        .filter((x): x is string => x !== null);

      const stockWarehouseId = String(
        (existing as { warehouseId?: unknown }).warehouseId ??
          (existing as { warehouse?: unknown }).warehouse ??
          ""
      );

      if (stockWarehouseId && !allowedIds.includes(stockWarehouseId)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            detail: "Not allowed to delete this stock",
          },
          { status: 403 }
        );
      }
    }

    await existing.deleteOne();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("DELETE ERROR:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to delete stock",
      },
      { status: 500 }
    );
  }
}
