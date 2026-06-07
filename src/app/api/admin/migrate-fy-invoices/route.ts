import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { verifyAndGetUser, ensureAdmin } from "@/lib/authorize";
import { runMigrateFyInvoices } from "@/lib/migrateFyInvoices";

export const dynamic = "force-dynamic";

type MigrateBody = {
  confirm?: boolean;
};

/**
 * Renumbers all bills by Indian FY — INV-YYYY-000001 per FY,
 * ordered by billDate then createdAt. Updates per-FY InvoiceCounter seq to last used.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAndGetUser(req);
    ensureAdmin(user);

    const body = (await req.json().catch(() => ({}))) as MigrateBody;
    if (!body.confirm) {
      return NextResponse.json(
        {
          error: 'Send JSON body { "confirm": true } to run migration.',
        },
        { status: 400 }
      );
    }

    await dbConnect();
    const result = await runMigrateFyInvoices();

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Migration failed";
    let status = 500;
    if (
      message.includes("Missing Authorization") ||
      message.includes("verification failed")
    ) {
      status = 401;
    } else if (message.includes("Access denied")) {
      status = 403;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
