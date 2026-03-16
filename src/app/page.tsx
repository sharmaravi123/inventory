// src/app/page.tsx (Server Component)

import LoginPage from "./components/login/Login";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAppToken } from "@/lib/jwt";

type CompanyProfile = {
  name?: string;
};

/* ================= DYNAMIC METADATA ================= */

export async function generateMetadata() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/company-profile`,
      {
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) throw new Error("Failed");

    const data: CompanyProfile = await res.json();

    const companyName = data?.name || "Inventory System";

    return {
      title: `Login | ${companyName}`,
      description: `Login to ${companyName} to manage your stock, billing, and operations efficiently.`,
    };
  } catch {
    return {
      title: "Login | Inventory System",
      description:
        "Login to the inventory system to manage your stock, billing, and operations efficiently.",
    };
  }
}

/* ================= PAGE ================= */

export default async function Page() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("adminToken")?.value ??
    cookieStore.get("token")?.value ??
    null;

  if (token) {
    try {
      const payload = verifyAppToken(token);
      const role = payload?.role?.toLowerCase() ?? "";

      if (role === "admin") redirect("/admin");
      if (role === "warehouse") redirect("/warehouse");
      if (role === "driver") redirect("/driver");
    } catch {
      // Invalid token, fall through to login page
    }
  }

  return <LoginPage />;
}
