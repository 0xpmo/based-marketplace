// frontend/src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCollections } from "@/hooks/useContracts";
import CollectionCard from "@/components/collections/CollectionCard";
import PepeButton from "@/components/ui/PepeButton";
import PepeConfetti from "@/components/effects/PepeConfetti";

export default function Home() {
  const { collections, loading } = useCollections();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Show confetti animation after a short delay for fun
    const timer = setTimeout(() => setShowConfetti(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-950 to-background">
      <PepeConfetti trigger={showConfetti} />

      {/* Hero section */}
      <section className="relative w-full pt-16 pb-32 px-4 overflow-hidden">
        {/* Ocean Background Animation */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-900/70 to-blue-950/80 backdrop-blur-sm"></div>

        {/* Animated Wave Overlays */}
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
          <svg
            className="absolute bottom-0 w-full h-48"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              fill="#1e3a8a"
              opacity=".3"
              className="animate-[wave_25s_ease-in-out_infinite]"
            ></path>
            <path
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              fill="#1e3a8a"
              opacity=".5"
              className="animate-[wave_20s_ease-in-out_infinite_reverse]"
            ></path>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center md:text-left"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  BasedSea Marketplace
                </span>
              </h1>
              <p className="text-lg md:text-xl text-blue-100 mb-8">
                Dive into the ocean of NFTs on the Based AI blockchain.
                Discover, collect, and trade unique digital treasures in the
                depths of BasedSea!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Link href="/collections">
                  <PepeButton
                    variant="primary"
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500 relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                    Explore Collections
                  </PepeButton>
                </Link>
                <Link href="/collections/create">
                  <PepeButton
                    variant="outline"
                    size="lg"
                    className="border-blue-500 text-blue-300 hover:bg-blue-900/30"
                  >
                    Create Collection
                  </PepeButton>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden md:block relative h-80 w-full"
            >
              <Image
                src="/images/ocean-nft.jpg"
                alt="BasedSea NFT Showcase"
                fill
                className="object-contain rounded-xl"
                onError={(e) => {
                  e.currentTarget.src = "/images/placeholder-nft.png";
                }}
              />

              {/* Floating Bubbles */}
              <div className="absolute inset-0">
                {[...Array(8)].map((_, i) => {
                  const size = Math.floor(Math.random() * 30) + 10;
                  const left = Math.floor(Math.random() * 80) + 10;
                  const top = Math.floor(Math.random() * 80) + 10;
                  const delay = Math.random() * 5;
                  const duration = Math.random() * 10 + 10;

                  return (
                    <div
                      key={i}
                      className="absolute rounded-full bg-blue-400/20"
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${left}%`,
                        top: `${top}%`,
                        animationDelay: `${delay}s`,
                        animationDuration: `${duration}s`,
                        animation: "float infinite ease-in-out",
                      }}
                    />
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Top collections section */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-950/70 to-blue-900/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Top Collections
            </h2>
            <Link href="/collections">
              <PepeButton
                variant="ghost"
                className="text-blue-300 hover:text-blue-100 hover:bg-blue-800/30"
              >
                View All
              </PepeButton>
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400" />
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12 bg-blue-900/30 border border-blue-800/30 rounded-xl backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-4 text-blue-100">
                No collections yet
              </h3>
              <p className="text-blue-300 mb-6">
                Be the first to create a collection!
              </p>
              <Link href="/collections/create">
                <PepeButton
                  variant="primary"
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                >
                  Create Collection
                </PepeButton>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.slice(0, 6).map((collection, index) => (
                <motion.div
                  key={collection.address}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                >
                  <CollectionCard collection={collection} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features section */}
      <section className="py-16 px-4 bg-blue-900/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">
            Why Choose BasedSea Marketplace
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-blue-900/30 p-6 rounded-lg shadow-lg border border-blue-800/30 backdrop-blur-sm"
            >
              <div className="h-12 w-12 bg-blue-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-blue-100">
                Fast & Low Fees
              </h3>
              <p className="text-blue-300">
                Experience lightning-fast transactions and minimal fees on the
                Based AI blockchain.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-blue-900/30 p-6 rounded-lg shadow-lg border border-blue-800/30 backdrop-blur-sm"
            >
              <div className="h-12 w-12 bg-blue-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-blue-100">
                Secure Ownership
              </h3>
              <p className="text-blue-300">
                Your NFTs are securely stored on the blockchain with verifiable
                ownership.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-blue-900/30 p-6 rounded-lg shadow-lg border border-blue-800/30 backdrop-blur-sm"
            >
              <div className="h-12 w-12 bg-blue-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-blue-100">
                Creator Royalties
              </h3>
              <p className="text-blue-300">
                Creators earn royalties on secondary sales, supporting the
                artist community.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-900/80 to-cyan-900/70 relative overflow-hidden">
        {/* Animated wave overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden">
          <svg
            className="absolute bottom-0 w-full h-32"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              fill="#0f172a"
              opacity=".4"
              className="animate-[wave_25s_ease-in-out_infinite]"
            ></path>
          </svg>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
            Ready to dive into the NFT ocean?
          </h2>
          <p className="text-lg text-blue-200 mb-8 max-w-2xl mx-auto">
            Join thousands of collectors and creators on the Based AI
            blockchain&apos;s premier NFT marketplace.
          </p>
          <Link href="/collections">
            <PepeButton
              variant="primary"
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500 ocean-pulse-animation"
            >
              Get Started Now
            </PepeButton>
          </Link>
        </div>
      </section>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.1;
          }
          50% {
            transform: translateY(-40px) scale(1.2);
            opacity: 0.4;
          }
          100% {
            transform: translateY(-80px) scale(0.8);
            opacity: 0;
          }
        }

        .ocean-pulse-animation {
          position: relative;
          overflow: hidden;
        }
        .ocean-pulse-animation::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(56, 189, 248, 0.2);
          opacity: 0;
          animation: oceanPulse 2s infinite;
        }
        @keyframes oceanPulse {
          0% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes wave {
          0% {
            transform: translateX(0) translateZ(0) scaleY(1);
          }
          50% {
            transform: translateX(-25%) translateZ(0) scaleY(0.8);
          }
          100% {
            transform: translateX(-50%) translateZ(0) scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
