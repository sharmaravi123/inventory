'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import { Pagination } from 'swiper/modules';
import Head from 'next/head';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Login | Aakash Inventory</title>
        <meta
          name="description"
          content="Login to Aakash Inventory to manage your stock, billing, and operations efficiently."
        />
        <meta name="keywords" content="inventory management, login, billing, stock, aakash inventory" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-[var(--color-neutral)]">
        <div className="w-full max-w-7xl flex flex-col md:flex-row bg-[var(--color-white)] rounded-2xl shadow-[var(--shadow-medium)] overflow-hidden">

          {/* 🖼️ Left Section */}
          <div className="md:w-1/2 w-full relative flex items-center justify-center bg-[var(--color-neutral)] p-6">
            <Swiper
              modules={[Pagination]}
              pagination={{ clickable: true }}
              loop
              className="w-full h-full max-w-xl"
            >
              <SwiperSlide>
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="relative text-center"
                >
                  <img
                    src="/login/login.png"
                    alt="Inventory Management Illustration"
                    className="mx-auto w-full max-w-md drop-shadow-xl opacity-90"
                  />

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-sidebar)] drop-shadow-md">
                      Efficient Inventory Management at Your Fingertips
                    </h2>
                    <p className="text-[var(--text-secondary)] mt-3 text-base md:text-lg max-w-lg">
                      Streamline your operations, optimize stock, and <br /> enhance billing
                      with <span className="font-semibold text-[var(--color-primary)]">Aakash Inventory</span>.
                    </p>
                  </div>
                </motion.div>
              </SwiperSlide>
            </Swiper>

            <footer className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-[var(--text-muted)]">
              © 2025 Aakash Inventory. All rights reserved.
            </footer>
          </div>

          {/* 🔐 Right Section - Login Form */}
          <div className="md:w-1/2 w-full flex items-center justify-center bg-[var(--color-white)] p-8 md:p-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="w-full max-w-md bg-[var(--color-neutral)] rounded-2xl shadow-[var(--shadow-light)] p-8"
            >
              <h1 className="text-3xl font-extrabold text-center text-[var(--color-primary)] mb-6">
                Aakash <span className="text-[var(--color-sidebar)]">Inventory</span>
              </h1>
              <h2 className="text-xl font-bold text-center mb-4 text-[var(--color-sidebar)]">
                Login to Inventory
              </h2>
              <p className="text-center text-[var(--text-secondary)] mb-8 text-sm">
                Welcome back! Enter your credentials to continue.
              </p>

                <div className="space-y-5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-[var(--color-sidebar)] mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="your.email@aakash.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-[var(--border-color)] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-[var(--color-sidebar)] mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-[var(--border-color)] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[var(--color-primary)] text-[var(--color-white)] font-semibold py-2 rounded-lg shadow-md hover:bg-[var(--color-success)] transition-all"
                  onClick={() => router.push('/admin')}
                >
                  Login
                </motion.button>

              <div className="text-center mt-4">
                <a
                  href="#"
                  className="text-sm text-[var(--color-primary)] hover:underline hover:text-[var(--color-sidebar)]"
                >
                  Forgot Password?
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
