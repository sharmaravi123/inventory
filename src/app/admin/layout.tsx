import React from "react";
import AdminShell from "./components/AdminShell";

export const metadata = {
  title: "Admin Panel | BlackOSInventory",
  description: "Admin dashboard",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
