// frontend/src/components/ClientLayout.tsx
"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import dynamic from "next/dynamic";

// Import ClientOnly with SSR disabled
const ClientOnly = dynamic(() => import("@/components/ClientOnly"), {
  ssr: false,
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientOnly>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow mb-40">{children}</main>
        <Footer />
        <ToastContainer position="bottom-right" theme="dark" />
      </div>
    </ClientOnly>
  );
}
