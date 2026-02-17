import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ReduxProvider from "@/providers/ReduxProvider";
import PwaRegister from "./components/pwa";
import DisableNumberWheel from "./components/DisableNumberWheel";

// Load Google fonts as CSS variables
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Inventory System",
  description: "Inventory Management System",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A73E8",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js");
    });
  }
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ReduxProvider is a client component, rendered via server layout */}
        <DisableNumberWheel />
        <PwaRegister />
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
