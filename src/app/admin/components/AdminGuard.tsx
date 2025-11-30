"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const authRole = useSelector((state: RootState) => state.auth.role);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const checkAuth = useCallback(async () => {
    // 1. First check Redux state
    if (authRole === "admin") {
      setIsAuthorized(true);
      setIsLoading(false);
      return;
    }

    // 2. Check cookie via API call (server-side safe)
    try {
      const response = await fetch("/api/admin/me", {
        credentials: "include", // Critical for cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.role === "admin") {
          setIsAuthorized(true);
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }

    setIsLoading(false);
  }, [authRole]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  // Not authorized - redirect
  if (!isAuthorized) {
    router.replace("/");
    router.refresh();
    return null;
  }

  return <>{children}</>;
}
