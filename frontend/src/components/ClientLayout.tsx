// frontend/src/components/ClientLayout.tsx
"use client";

import { Toaster } from "react-hot-toast"; // Change this import
// import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Image from "next/image";
import PepeButton from "./ui/PepeButton";
import { useState, useEffect } from "react";
import { TokenPriceProvider } from "@/contexts/TokenPriceContext";
// Database initialization is now handled server-side

// Import ClientOnly with SSR disabled
const ClientOnly = dynamic(() => import("@/components/ClientOnly"), {
  ssr: false,
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isComingSoon = false; // Set to false when ready to launch
  const [bypass, setBypass] = useState(false);
  const [keySequence, setKeySequence] = useState("");
  const secretPassword = "kekitykek";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Add the key to the sequence
      const newSequence = keySequence + e.key;

      // Keep only the last N characters where N is the length of our password
      const trimmedSequence = newSequence.slice(-secretPassword.length);
      setKeySequence(trimmedSequence);

      // Check if the sequence matches the password
      if (trimmedSequence === secretPassword) {
        setBypass(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [keySequence]);

  // Show the actual site if bypass is true or isComingSoon is false
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
            className="flex gap-4 justify-center"
          >
            <a
              href="https://x.com/basedsea_xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30 p-3"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </PepeButton>
            </a>
            <a
              href="https://t.me/+61XecOgCg540MzQx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30 p-3"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </PepeButton>
            </a>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <TokenPriceProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 5000,
              style: {
                background: "#1e1e1e",
                color: "#fff",
              },
              success: {
                duration: 3000,
                // theme: {
                //   primary: '#48BB78',
                //   secondary: '#38A169',
                // },
              },
              error: {
                duration: 4000,
                // theme: {
                //   primary: '#F56565',
                //   secondary: '#E53E3E',
                // },
              },
            }}
          />
          {/* <ToastContainer position="bottom-right" theme="dark" /> */}
        </div>
      </TokenPriceProvider>
    </ClientOnly>
  );
}
