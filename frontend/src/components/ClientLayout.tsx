// frontend/src/components/ClientLayout.tsx
"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Image from "next/image";
import PepeButton from "./ui/PepeButton";

// Import ClientOnly with SSR disabled
const ClientOnly = dynamic(() => import("@/components/ClientOnly"), {
  ssr: false,
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add this flag at the top of your component, after the existing hooks
  const isComingSoon = true; // Set to false when ready to launch

  // Add this early return right before your "const topCollections = collections.slice(0, 3);" line
  if (isComingSoon) {
    return (
      <div className="fixed inset-0 w-full h-full z-50 bg-gradient-to-b from-blue-950 to-blue-900 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl mx-auto"
        >
          <div className="w-48 h-48 mx-auto mb-8 relative">
            <Image
              src="/images/whale-logo.jpg"
              alt="BasedSea Logo"
              className="rounded-2xl"
              fill
              priority
            />
          </div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Coming Soon
          </motion.h1>

          <motion.p
            className="text-xl text-cyan-100 mb-8 max-w-md mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            The most based NFT marketplace on the BasedAI blockchain is
            launching soon
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <a
              href="https://twitter.com/basedsea_xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30"
              >
                Follow us on Twitter
              </PepeButton>
            </a>
          </motion.div>
        </motion.div>
      </div>
    );
  }

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
