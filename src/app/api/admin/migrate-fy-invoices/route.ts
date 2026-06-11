import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { verifyAndGetUser, ensureAdmin } from "@/lib/authorize";
import { runMigrateFyInvoices } from "@/lib/migrateFyInvoices";

export const dynamic = "force-dynamic";

type MigrateBody = {
  confirm?: boolean;
  /** If true, renumber every bill (all FYs). Otherwise only FY >= minFinancialYear (default 2026). */
  full?: boolean;
  /** Indian FY start year, e.g. 2026 = Apr 2026–Mar 2027. Ignored when full is true. */
  minFinancialYear?: number;
};

/**
 * Renumbers bills by Indian FY — INV-YYYY-000001 per FY (default: FY >= 2026 only).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAndGetUser(req);
    ensureAdmin(user);

    const body = (await req.json().catch(() => ({}))) as MigrateBody;
    if (!body.confirm) {
      return NextResponse.json(
        {
          error:
            'Send JSON body { "confirm": true }. Optional: "full": true for all FYs, or "minFinancialYear": 2026.',
        },
        { status: 400 }
      );
    }

    await dbConnect();
    const result =
      body.full === true
        ? await runMigrateFyInvoices({})
        : await runMigrateFyInvoices({
            minFinancialYear:
              typeof body.minFinancialYear === "number" &&
              Number.isFinite(body.minFinancialYear)
                ? body.minFinancialYear
                : 2026,
          });

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
