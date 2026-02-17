// src/app/page.tsx (Server Component)

import LoginPage from "./components/login/Login";

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

export default function Page() {
  return <LoginPage />;
}
