// src/app/api/driver/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import DriverModel, { DriverDocument } from "@/models/Driver";
import { Types } from "mongoose";
import { verifyAppToken } from "@/lib/jwt";

type DriverSafe = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  vehicleNumber: string;
  vehicleType?: string;
};

type SuccessBody = {
  driver: DriverSafe;
};

type ErrorBody = { error: string };

const COOKIE_NAME = "token";

function toSafeDriver(doc: DriverDocument): DriverSafe {
  return {
    _id: (doc._id as Types.ObjectId).toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    vehicleNumber: doc.vehicleNumber,
    vehicleType: doc.vehicleType,
  };
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  try {
    await dbConnect();

    const cookie = req.cookies.get(COOKIE_NAME);
    if (!cookie || !cookie.value) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let driverId = "";

    try {
      const payload = verifyAppToken(cookie.value);
      if (payload.role !== "DRIVER") {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }
      driverId = payload.sub;
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const driver = await DriverModel.findById(driverId).exec();
    if (!driver || !driver.isActive) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { driver: toSafeDriver(driver) },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Driver me error:", message);
    return NextResponse.json(
      { error: "Failed to fetch driver" },
      { status: 500 }
    );
  }
}
