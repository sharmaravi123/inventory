import { NextResponse } from "next/server";
import cookie from "cookie";

/**
 * POST /api/auth/logout
 * Clears auth cookies.
 */
export async function POST() {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const cookieStr = cookie.serialize("token", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    const res = NextResponse.json({ success: true });
    res.headers.append("Set-Cookie", cookieStr);

    const adminCookie = cookie.serialize("adminToken", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.headers.append("Set-Cookie", adminCookie);

    const userCookie = cookie.serialize("userToken", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.headers.append("Set-Cookie", userCookie);

    const warehouseCookie = cookie.serialize("warehouseToken", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.headers.append("Set-Cookie", warehouseCookie);

    const driverCookie = cookie.serialize("driverToken", "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.headers.append("Set-Cookie", driverCookie);

    return res;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: (err as Error).message || "Server error" }, { status: 500 });
  }
}
