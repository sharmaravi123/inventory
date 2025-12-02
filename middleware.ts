// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getCookie(req: NextRequest, name: string): string | null {
  return req.cookies.get(name)?.value ?? null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // admin ke liye dono naam support karo: "adminToken" ya purana "token"
  const adminToken =
    getCookie(req, "adminToken") ?? getCookie(req, "token");

  const userToken = getCookie(req, "userToken");
  const warehouseToken = getCookie(req, "warehouseToken");
  const driverToken = getCookie(req, "driverToken");

  // 1) ROOT `/` – yahi sabka login page hai → hamesha allow
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 2) Baaki public paths (agar future me alag login pages banaye)
  const publicPaths: string[] = [
    "/login",
    "/admin/login",
    "/warehouse/login",
    "/driver/login",
  ];

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 3) ADMIN PAGES PROTECT
  if (pathname.startsWith("/admin")) {
    if (!adminToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 4) WAREHOUSE PAGES PROTECT – isko main touch nahi kar raha
  if (pathname.startsWith("/warehouse")) {
    if (!warehouseToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 5) API PROTECTION – driver/user/warehouse same hi rakhe
  if (pathname.startsWith("/api")) {
    // admin APIs
    if (pathname.startsWith("/api/admin")) {
      if (!adminToken) {
        return NextResponse.json(
          { message: "Unauthorized - Missing admin token" },
          { status: 401 },
        );
      }
      return NextResponse.next();
    }

    // driver APIs
    if (pathname.startsWith("/api/driver")) {
      if (!driverToken) {
        return NextResponse.json(
          { message: "Unauthorized - Missing driver token" },
          { status: 401 },
        );
      }
      return NextResponse.next();
    }

    // user APIs
    if (pathname.startsWith("/api/user")) {
      if (!userToken) {
        return NextResponse.json(
          { message: "Unauthorized - Missing user token" },
          { status: 401 },
        );
      }
      return NextResponse.next();
    }

    // warehouse APIs
    if (pathname.startsWith("/api/warehouse")) {
      if (!warehouseToken) {
        return NextResponse.json(
          { message: "Unauthorized - Missing warehouse token" },
          { status: 401 },
        );
      }
      return NextResponse.next();
    }

    // Baaki generic APIs ko allow kar do (products, stocks, etc.)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/warehouse/:path*", "/api/:path*"],
};
