"use client";

import { useState, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { Pagination } from "swiper/modules";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { adminLogin, userLogin } from "@/store/authSlice";
import { loginDriver } from "@/store/driverSlice";
import { AppDispatch } from "@/store/store";

type LoginRole = "admin" | "user" | "driver";

export default function LoginPage() {
  const [role, setRole] = useState<LoginRole>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password || submitting) {
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      if (role === "driver") {
        await dispatch(loginDriver({ email, password })).unwrap();
        router.push("/driver");
        router.refresh();
        return;
      }

      if (role === "admin") {
        await dispatch(adminLogin({ email, password })).unwrap();
        router.push("/admin");
        router.refresh();
        return;
      }

      if (role === "user") {
        await dispatch(userLogin({ email, password })).unwrap();
        router.push("/warehouse");
        router.refresh();
        return;
      }

      setLocalError("Invalid role selection.");
    } catch (err: unknown) {
      if (typeof err === "string") {
        setLocalError(err);
      } else if (typeof err === "object" && err !== null && "error" in err) {
        const msg = (err as { error?: string }).error;
        setLocalError(msg || "Invalid credentials");
      } else {
        setLocalError("Invalid credentials");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-neutral)] py-10">
      <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left - Visual */}
        <div className="hidden md:block bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-sidebar)] p-8 relative">
          <div className="h-full flex flex-col justify-center items-start text-white">
            <h2 className="text-3xl font-extrabold mb-2">Aakash Inventory</h2>
            <p className="mb-6 text-sm max-w-xs">
              Manage warehouses, users, drivers and inventory seamlessly. Fast,
              reliable and secure.
            </p>

            <div className="w-full max-w-xs">
              <Swiper modules={[Pagination]} pagination={{ clickable: true }} loop>
                <SwiperSlide>
                  <div className="p-4">
                    <img
                      src="/login/login.png"
                      alt="Inventory"
                      className="w-full rounded-lg shadow-sm"
                    />
                  </div>
                </SwiperSlide>
              </Swiper>
            </div>
          </div>

          <footer className="absolute bottom-4 left-8 text-xs text-white/90">
            © {new Date().getFullYear()} Aakash Inventory
          </footer>
        </div>

        {/* Right - Form */}
        <div className="p-8 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-md mx-auto"
          >
            <h1 className="text-2xl font-extrabold text-[var(--color-primary)] text-center mb-2">
              Welcome to{" "}
              <span className="text-[var(--color-sidebar)]">Aakash Inventory</span>
            </h1>
            <p className="text-center text-xs text-[var(--text-secondary)] mb-6">
              Select your role and use your registered email and password to login.
            </p>

            <div className="flex justify-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                  role === "admin"
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-white text-[var(--text-secondary)] border-gray-300"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                  role === "user"
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-white text-[var(--text-secondary)] border-gray-300"
                }`}
              >
                Warehouse User
              </button>
              <button
                type="button"
                onClick={() => setRole("driver")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                  role === "driver"
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-white text-[var(--text-secondary)] border-gray-300"
                }`}
              >
                Driver
              </button>
            </div>

            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
            />

            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] text-white py-2 rounded-lg font-semibold hover:brightness-95 transition mb-3 disabled:opacity-60"
            >
              {submitting
                ? role === "admin"
                  ? "Logging in as Admin..."
                  : role === "user"
                  ? "Logging in as User..."
                  : "Logging in as Driver..."
                : "Login"}
            </button>

            {localError && (
              <p className="text-red-500 text-sm text-center mt-2">
                {localError}
              </p>
            )}

            <div className="mt-6 text-center text-xs text-[var(--text-secondary)]">
              By logging in you agree to our{" "}
              <span className="underline">Terms</span> and{" "}
              <span className="underline">Privacy</span>.
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
