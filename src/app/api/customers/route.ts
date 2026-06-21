import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import CustomerModel, {
  ensureCustomerPhoneIndex,
} from "@/models/Customer";
import BillModel from "@/models/Bill";
import { makeCustomerSnapshotKey } from "@/lib/customerIdentity";

type CustomersResponse = {
  customers: CustomerListItem[];
  idAliases?: Record<string, string>;
};

type CustomerListItem = {
  _id?: string;
  name: string;
  shopName?: string;
  phone?: string;
  address: string;
  gstNumber?: string;
  customPrices?: { product: string; price: number }[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

type BillCustomerSnapshot = {
  customerInfo?: {
    customer?: unknown;
    name?: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toIdString = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return value.toString();
  }
  return "";
};

const makeSnapshotKey = (info: {
  name?: string;
  shopName?: string;
  phone?: string;
}) => {
  const phone = normalizeText(info.phone);
  if (phone) return `phone:${phone}`;
  return makeCustomerSnapshotKey(info);
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

    const payload: Record<string, string> = {
      name,
      address: address || "",
    };

    if (normalizedPhone) {
      payload.phone = normalizedPhone;
    }
    if (shopName) {
      payload.shopName = shopName;
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

    const savedCustomers = await CustomerModel.find(filter)
      .sort({ createdAt: -1 })
      .lean<CustomerListItem[]>()
      .exec();

    const customersByKey = new Map<string, CustomerListItem>();
    const keyByCustomerId = new Map<string, string>();
    const keyByPhone = new Map<string, string>();
    const snapshotPrimaryKey = new Map<string, string>();
    const snapshotPrimaryId = new Map<string, string>();
    const phonePrimaryId = new Map<string, string>();
    const idAliases: Record<string, string> = {};

    for (const customer of savedCustomers) {
      const id = toIdString(customer._id);
      const snap = makeSnapshotKey(customer);
      const phone = normalizeText(customer.phone);

      if (phone && phonePrimaryId.has(phone)) {
        const primaryId = phonePrimaryId.get(phone)!;
        if (id) {
          idAliases[id] = primaryId;
          keyByCustomerId.set(id, `id:${primaryId}`);
        }
        continue;
      }

      const key = id ? `id:${id}` : snap;
      const item = {
        ...customer,
        _id: id || customer._id,
        address: customer.address || "",
      };

      const existingPrimary = snapshotPrimaryKey.get(snap);
      const existingPrimaryId = snapshotPrimaryId.get(snap);
      if (existingPrimary && existingPrimaryId && id) {
        idAliases[id] = existingPrimaryId;
        keyByCustomerId.set(id, existingPrimary);
        if (phone) keyByPhone.set(phone, existingPrimary);
        continue;
      }

      customersByKey.set(key, item);
      if (id) keyByCustomerId.set(id, key);
      snapshotPrimaryKey.set(snap, key);
      if (id) snapshotPrimaryId.set(snap, id);

      if (phone) {
        keyByPhone.set(phone, key);
        if (id) phonePrimaryId.set(phone, id);
      }
    }

    const billFilter: Record<string, unknown> = {};
    if (q.length > 0) {
      billFilter["$or"] = [
        { "customerInfo.name": { $regex: q, $options: "i" } },
        { "customerInfo.shopName": { $regex: q, $options: "i" } },
        { "customerInfo.phone": { $regex: q, $options: "i" } },
      ];
    }

    const billCustomers = await BillModel.find(billFilter)
      .select("customerInfo createdAt")
      .sort({ createdAt: -1 })
      .lean<BillCustomerSnapshot[]>()
      .exec();

    for (const bill of billCustomers) {
      const info = bill.customerInfo;
      if (!info) continue;

      const name = normalizeText(info.name);
      const shopName = normalizeText(info.shopName);
      const phone = normalizeText(info.phone);
      if (!name && !shopName && !phone) continue;

      const customerId = toIdString(info.customer);
      const existingKey =
        (customerId && keyByCustomerId.get(customerId)) ||
        (phone && keyByPhone.get(phone)) ||
        "";
      const key = existingKey || makeSnapshotKey(info);

      if (customersByKey.has(key)) continue;

      const item: CustomerListItem = {
        _id: customerId || key,
        name: name || shopName || "Unknown",
        shopName,
        phone,
        address: normalizeText(info.address),
        gstNumber: normalizeText(info.gstNumber),
      };

      customersByKey.set(key, item);
      if (customerId) keyByCustomerId.set(customerId, key);
      if (phone) keyByPhone.set(phone, key);
    }

    return NextResponse.json({
      customers: Array.from(customersByKey.values()),
      idAliases,
    });
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

    const setPayload: Record<string, string> = {
      name,
      address: address || "",
    };
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
