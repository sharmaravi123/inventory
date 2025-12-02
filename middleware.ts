// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getCookie(req: NextRequest, name: string): string | null {
  return req.cookies.get(name)?.value ?? null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const adminToken = getCookie(req, "token");
  const userToken = getCookie(req, "userToken");
  const warehouseToken = getCookie(req, "warehouseToken");
  const driverToken = getCookie(req, "driverToken");

  // 1) ROOT `/` ko hamesha allow karo (yahi login page hai sabke liye)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 2) API ke login routes ko bypass karo (yahan token ki need nahi hai)
  if (
    pathname === "/api/admin/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/driver/login"
  ) {
    return NextResponse.next();
  }

  // 3) ADMIN PAGES PROTECT
  //    Ab yahan `/admin` public nahi hai, kyunki upar sirf "/" ko allow kiya hai
  if (pathname.startsWith("/admin")) {
    if (!adminToken) {
      const url = req.nextUrl.clone();
      // sab logins `/` se hi hote hain
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 4) WAREHOUSE PAGES PROTECT
  if (pathname.startsWith("/warehouse")) {
    if (!warehouseToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 5) APIs PROTECT
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

    // baaki generic APIs jaise /api/products, /api/stocks, etc.
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Middleware sirf admin, warehouse pages aur /api pe lagega
export const config = {
  matcher: ["/admin/:path*", "/warehouse/:path*", "/api/:path*"],
};
