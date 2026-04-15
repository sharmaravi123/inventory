import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import CustomerModel, {
  CustomerDocument,
  ensureCustomerPhoneIndex,
} from "@/models/Customer";

type CustomersResponse = {
  customers: CustomerDocument[];
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    await ensureCustomerPhoneIndex();

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const normalizedPhone =
      typeof body?.phone === "string" ? body.phone.trim() : "";
    const shopName =
      typeof body?.shopName === "string" ? body.shopName.trim() : "";
    const address =
      typeof body?.address === "string" ? body.address.trim() : "";
    const gstNumber =
      typeof body?.gstNumber === "string" ? body.gstNumber.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const payload: Record<string, string> = { name };

    if (normalizedPhone) {
      payload.phone = normalizedPhone;
    }
    if (shopName) {
      payload.shopName = shopName;
    }
    if (address) {
      payload.address = address;
    }
    if (gstNumber) {
      payload.gstNumber = gstNumber;
    }

    let customer;
    if (normalizedPhone) {
      customer = await CustomerModel.findOneAndUpdate(
        { phone: normalizedPhone },
        { $set: payload },
        { new: true, upsert: true }
      );
    } else {
      customer = await CustomerModel.create(payload);
    }

    return NextResponse.json(
      { customer },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === 11000
    ) {
      return NextResponse.json(
        { error: "This phone number is already linked to another customer" },
        { status: 409 }
      );
    }

    const message =
      e instanceof Error ? e.message : "Failed to create customer";
    console.error("CUSTOMER CREATE ERROR:", e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<CustomersResponse | { error: string }>> {
  try {
    await dbConnect();
    await ensureCustomerPhoneIndex();

    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim();

    const filter: Record<string, unknown> = {};

    if (q.length > 0) {
      filter["$or"] = [
        { name: { $regex: q, $options: "i" } },
        { shopName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const customers = await CustomerModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    return NextResponse.json({ customers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    await ensureCustomerPhoneIndex();

    const body = await req.json();
    const id = typeof body?._id === "string" ? body._id : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const shopName =
      typeof body?.shopName === "string" ? body.shopName.trim() : "";
    const address =
      typeof body?.address === "string" ? body.address.trim() : "";
    const gstNumber =
      typeof body?.gstNumber === "string" ? body.gstNumber.trim() : "";

    if (!id) {
      return NextResponse.json(
        { error: "Customer id is required" },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const setPayload: Record<string, string> = { name };
    const unsetPayload: Record<string, 1> = {};

    if (phone) {
      setPayload.phone = phone;
    } else {
      unsetPayload.phone = 1;
    }

    if (shopName) {
      setPayload.shopName = shopName;
    } else {
      unsetPayload.shopName = 1;
    }

    if (address) {
      setPayload.address = address;
    } else {
      unsetPayload.address = 1;
    }

    if (gstNumber) {
      setPayload.gstNumber = gstNumber;
    } else {
      unsetPayload.gstNumber = 1;
    }

    const updateQuery: {
      $set: Record<string, string>;
      $unset?: Record<string, 1>;
    } = {
      $set: setPayload,
    };

    if (Object.keys(unsetPayload).length > 0) {
      updateQuery.$unset = unsetPayload;
    }

    const updated = await CustomerModel.findByIdAndUpdate(
      id,
      updateQuery,
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer: updated }, { status: 200 });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === 11000
    ) {
      return NextResponse.json(
        { error: "This phone number is already linked to another customer" },
        { status: 409 }
      );
    }

    const message =
      e instanceof Error ? e.message : "Failed to update customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
