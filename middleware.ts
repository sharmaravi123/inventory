// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const PUBLIC_PATHS = [
  "/", "/login", "/signup",
  "/api/admin/login",
  "/api/admin/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/warehouse",
  "/api/warehouse/create",
  "/api/categories",
  "/api/products",
  "/api/stocks",
  "/api/user/create",
  "/favicon.ico",
  "/robots.txt",
];

// updated
function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow internals and assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.startsWith("/public") || pathname.startsWith("/images")) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const isAdminUI = pathname === "/admin" || pathname.startsWith("/admin/");

  // Server-side cookies only; DO NOT try to access localStorage here
  const token = req.cookies.get("token")?.value ?? null;

  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized - Missing token" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "") as any;

    if (isAdminUI && payload?.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch (err) {
    // invalid token: clear cookie and redirect
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    const res = NextResponse.redirect(url);
    res.cookies.set("token", "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: ["/api/:path*", "/admin", "/admin/:path*"],
};
