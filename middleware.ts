// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getCookie(req: NextRequest, name: string): string | null {
  return req.cookies.get(name)?.value ?? null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const adminToken = getCookie(req, "adminToken");
  const userToken = getCookie(req, "userToken");
  const warehouseToken = getCookie(req, "warehouseToken");
  const driverToken = getCookie(req, "driverToken");

  // -------- PUBLIC PATHS KO BHI ALLOW KARNA ZARURI HAI --------
  const publicPaths: string[] = [
    "/",
    "/login",
    "/admin/login",
    "/warehouse/login",
    "/driver/login",
  ];

  // Agar koi public path hai, seedha allow karo
  if (publicPaths.some((publicPath) => pathname.startsWith(publicPath))) {
    return NextResponse.next();
  }

  // -------- API LOGIN ROUTES KO BHI BYPASS KARO --------
  if (
    pathname === "/api/admin/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/driver/login"
  ) {
    return NextResponse.next();
  }

  // -------- ADMIN PAGES PROTECT --------
  if (pathname.startsWith("/admin")) {
    if (!adminToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // -------- WAREHOUSE PAGES PROTECT --------
  if (pathname.startsWith("/warehouse")) {
    if (!warehouseToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // -------- API PROTECTION --------
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

// Make sure matcher covers sirf relevant paths
export const config = {
  matcher: ["/admin/:path*", "/warehouse/:path*", "/api/:path*"],
};
