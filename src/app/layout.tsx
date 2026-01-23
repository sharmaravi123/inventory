import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/providers/ReduxProvider";
import PwaRegister from "./components/pwa";

// Load Google fonts as CSS variables
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata = {
  title: "Inventory System",
  description: "Inventory Management System",
  manifest: "/manifest.json",
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
      <meta name="theme-color" content="#1A73E8" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ReduxProvider is a client component, rendered via server layout */}
        <PwaRegister />
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
