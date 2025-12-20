// src/app/page.tsx (Server Component)
import LoginPage from "./components/login/Login"; // Login is a client component

export const metadata = {
  title: "Login | JMK TRADERS",
  description:
    "Login to JMK TRADERS to manage your stock, billing, and operations efficiently.",
};

export default function Page() {
  console.log(process.env.MONGODB_URI)
  return <LoginPage />; // fine: server component rendering client component
}
